import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

// Schema for the simplification response - now generates overlay content
const SimplificationResultSchema = z.object({
  title: z.string().describe("A title for the simplified view"),
  sections: z.array(z.object({
    heading: z.string().optional().describe("Section heading if applicable"),
    items: z.array(z.object({
      type: z.enum(["text", "link", "button", "image", "input"]).describe("Type of content"),
      content: z.string().describe("The text content or label"),
      selector: z.string().describe("CSS selector to interact with the original element"),
      href: z.string().optional().describe("URL for links"),
      src: z.string().optional().describe("Image source URL"),
      price: z.string().optional().describe("Price if applicable (for products)"),
    })).describe("Items in this section")
  })).describe("Organized sections of content"),
  message: z.string().describe("A brief message explaining what was extracted"),
});

type SimplificationResult = z.infer<typeof SimplificationResultSchema>;

const SIMPLIFY_SYSTEM_PROMPT = `You are Silver Surfer's Page Simplification AI. Your job is to analyze a webpage and EXTRACT the most relevant content based on the user's request.

You will receive:
1. A user's request describing what they want to focus on
2. A screenshot of the current webpage  
3. A structured list of page elements with their CSS selectors, image src URLs, and link hrefs

Your task is to CREATE a simplified view by extracting relevant content into organized sections.

OUTPUT STRUCTURE:
- title: A clear title for the simplified view (e.g., "Products on This Page", "Main Article")
- sections: Grouped content (e.g., "Featured Products", "Search Results", "Article Content")
  - Each section has items with: type, content, selector, and optional metadata
- message: Brief explanation of what you extracted

CONTENT TYPES:
- "text": Paragraphs, headings, descriptions
- "link": Clickable links (include the actual href from the element list)
- "button": Action buttons (add to cart, submit, etc.)
- "image": Product images, article images (MUST include the actual src URL from the element list)
- "input": Form fields the user might need

IMPORTANT RULES:
- Extract ACTUAL content from the page (text, prices, product names)
- Use the exact CSS selectors from the element list
- For images: You MUST copy the exact "src" URL from the element list - do NOT make up or guess image URLs
- For links: Use the exact "href" from the element list
- Group related items into logical sections
- For products: include name, price, image (with real src URL), and add-to-cart button
- For articles: include title, main text paragraphs, images (with real src URLs)
- Keep forms intact with all their inputs
- Focus on what the user asked for, ignore distractions

Examples:
- "Products only" → Extract product cards with names, prices, images (using actual src URLs), buy buttons
- "Article focus" → Extract article title, paragraphs, inline images (using actual src URLs)
- "Show prices under $50" → Filter products by price, show only matching ones`;

// Create the model with structured output
function createSimplifyAgent() {
  const model = new ChatOpenAI({
    modelName: process.env.OPENROUTER_MODEL || "openai/gpt-4o",
    temperature: 0,
    maxTokens: 4096,
    configuration: {
      baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": process.env.SITE_URL || "http://localhost:3000",
        "X-Title": process.env.SITE_NAME || "Silver Surfer",
      },
    },
  });

  return model.withStructuredOutput(SimplificationResultSchema);
}

// Format distilled DOM for the prompt
function formatDistilledDOM(dom: any, maxElements: number = 200): string {
  if (!dom) return "[No page structure available]";

  let output = `## Page: ${dom.title}\n`;
  output += `URL: ${dom.url}\n\n`;
  output += `### Elements (use these exact selectors)\n`;

  const elements = dom.elements?.slice(0, maxElements) || [];

  for (const el of elements) {
    let line = `<${el.tag}`;
    if (el.type) line += ` type="${el.type}"`;
    line += `> selector="${el.selector}"`;

    if (el.text) line += ` text="${el.text.substring(0, 40)}${el.text.length > 40 ? '...' : ''}"`;
    if (el.ariaLabel) line += ` aria="${el.ariaLabel}"`;
    if (el.alt) line += ` alt="${el.alt}"`;
    if (el.src) line += ` src="${el.src}"`;
    if (el.href) line += ` href="${el.href}"`;
    if (el.isInteractive) line += ` [interactive]`;

    output += line + "\n";
  }

  if ((dom.elements?.length || 0) > maxElements) {
    output += `\n... and ${dom.elements.length - maxElements} more elements\n`;
  }

  return output;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, page_state } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    console.log("=== Simplification Request ===");
    console.log("Prompt:", prompt);
    console.log("Has screenshot:", !!page_state?.screenshot);
    console.log("Has distilledDOM:", !!page_state?.distilledDOM);

    const agent = createSimplifyAgent();

    // Build the message content
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "high" | "low" | "auto" } }
    > = [];

    // Add user request
    content.push({
      type: "text",
      text: `User Request: "${prompt}"\n\nAnalyze the page and EXTRACT the relevant content into organized sections. Return the actual text content, prices, links, etc. from the page that match the user's request.`,
    });

    // Add screenshot if available
    if (page_state?.screenshot && page_state.screenshot.startsWith("data:image/")) {
      content.push({
        type: "image_url",
        image_url: {
          url: page_state.screenshot,
          detail: "high",
        },
      });
    }

    // Add distilled DOM
    if (page_state?.distilledDOM) {
      const pageStructure = formatDistilledDOM(page_state.distilledDOM);
      content.push({
        type: "text",
        text: `\n### Page Structure\n${pageStructure}`,
      });
    } else if (page_state?.html) {
      // Fallback: send a truncated version of HTML
      content.push({
        type: "text",
        text: `\n### Page HTML (truncated)\n${page_state.html.substring(0, 5000)}...`,
      });
    }

    const messages = [
      new SystemMessage(SIMPLIFY_SYSTEM_PROMPT),
      new HumanMessage({ content }),
    ];

    console.log("Invoking simplification agent...");

    const result = await agent.invoke(messages) as SimplificationResult;

    console.log("Simplification result:", {
      title: result.title,
      sectionsCount: result.sections.length,
      totalItems: result.sections.reduce((acc, s) => acc + s.items.length, 0),
      message: result.message,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Simplification error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Simplification failed",
        title: "Error",
        sections: [],
        message: "Failed to simplify page. Please try again.",
      },
      { status: 500 }
    );
  }
}
