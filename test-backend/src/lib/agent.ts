import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { allTools } from "./tools";
import type { ConversationAction, PageState, DistilledDOM, DOMElement } from "./types";

// System prompt for Silver Surfer agent
const SYSTEM_PROMPT = `You are Silver Surfer, an AI assistant that helps elderly users navigate websites. You can SEE the webpage through screenshots and understand its structure through a parsed element list.

## Your Mission
Help users accomplish tasks on websites by:
1. Analyzing what you SEE in the screenshot
2. Using the structured element list to find correct selectors
3. Taking precise actions using the provided CSS selectors
4. Verifying your actions worked by requesting to observe the page again

## How to Analyze Pages
When you receive a screenshot and element list:
1. LOOK at the screenshot carefully - identify buttons, links, forms, text
2. MATCH what you see visually with elements in the provided element list
3. USE the exact selector provided for each element (already generated for you)
4. The element list shows: tag, type, selector, text content, and other attributes

## Available Actions
- **click_element**: Click buttons, links, menu items. Provide the CSS selector.
- **fill_form_field**: Type into input fields. Provide selector and value.
- **select_dropdown**: Choose from dropdown menus. Provide selector and option value.
- **scroll_to_view**: Scroll to bring an element into view.
- **highlight_element**: Highlight an element to show the user.
- **magnify_text**: Make text larger for readability.
- **remove_clutter**: Hide ads and distracting elements.
- **send_message**: Communicate with the user (explain what you're doing, ask questions).
- **request_observation**: After performing actions, request a new screenshot to verify results.
- **complete_task**: When the task is fully accomplished.

## Multi-Step Task Approach
For complex tasks (e.g., "search for X and add to cart"):
1. Break down into steps mentally
2. Perform the first action (e.g., click search box)
3. Use request_observation to see the result
4. Based on new screenshot, perform next action
5. Continue until task is complete
6. Use complete_task with a summary

## Safety Rules
- NEVER click payment/purchase/delete buttons automatically
- NEVER fill password or credit card fields
- Always explain what you're about to do
- If unsure, ask the user

## Using Selectors
- Each element in the list has a pre-generated "selector" field - USE THAT EXACT SELECTOR
- Match visual elements in the screenshot with elements in the list using their text/type/position
- Example: If you see a "Sign In" button, find it in the element list and use its exact selector

IMPORTANT: You are looking at a REAL screenshot. Describe what you actually see, not what you assume. Be specific about element locations (top-right, center, etc.).`;

// Initialize the model with tool binding using OpenRouter
function createAgent() {
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

  return model.bindTools(allTools);
}

// Map tool names to action types
function mapToolToActionType(toolName: string): string {
  const mapping: Record<string, string> = {
    click_element: "click",
    highlight_element: "highlight",
    remove_highlights: "remove_highlights",
    magnify_text: "magnify",
    reset_magnification: "reset_magnification",
    scroll_to_view: "scroll",
    fill_form_field: "fill_form",
    select_dropdown: "select_dropdown",
    remove_clutter: "remove_clutter",
    restore_clutter: "restore_clutter",
    wait: "wait",
    send_message: "message",
    complete_task: "complete",
    request_observation: "request_observation",
  };
  return mapping[toolName] || toolName;
}

// Transform tool call to ConversationAction
function toolCallToAction(toolCall: {
  name: string;
  args: Record<string, unknown>;
}): ConversationAction {
  const actionType = mapToolToActionType(toolCall.name);
  const timestamp = new Date().toISOString();
  const args = toolCall.args;

  switch (actionType) {
    case "click":
      return {
        action_type: "click",
        x_path: args.selector as string,
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    case "highlight":
      return {
        action_type: "highlight",
        selector: args.selector as string,
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    case "remove_highlights":
      return {
        action_type: "remove_highlights",
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    case "magnify":
      return {
        action_type: "magnify",
        selector: args.selector as string,
        scale_factor: args.scale_factor as number | undefined,
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    case "reset_magnification":
      return {
        action_type: "reset_magnification",
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    case "scroll":
      return {
        action_type: "scroll",
        selector: args.selector as string,
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    case "fill_form":
      return {
        action_type: "fill_form",
        selector: args.selector as string,
        value: args.value as string,
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    case "select_dropdown":
      return {
        action_type: "select_dropdown",
        selector: args.selector as string,
        value: args.value as string,
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    case "remove_clutter":
      return {
        action_type: "remove_clutter",
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    case "restore_clutter":
      return {
        action_type: "restore_clutter",
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    case "wait":
      return {
        action_type: "wait",
        duration: args.duration as number,
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    case "message":
      return {
        action_type: "message",
        message: args.message as string,
        timestamp,
      };

    case "complete":
      return {
        action_type: "complete",
        message: args.message as string,
        timestamp,
      };

    case "request_observation":
      return {
        action_type: "request_observation" as any,
        timestamp,
        reasoning: args.reasoning as string | undefined,
      };

    default:
      return {
        action_type: "message",
        message: `Unknown action: ${actionType}`,
        timestamp,
      };
  }
}

// Format distilled DOM into a clean, readable format for the LLM
function formatDistilledDOM(dom: DistilledDOM | null, maxElements: number = 150): string {
  if (!dom) return "[No page structure available]";

  let output = `## Page: ${dom.title}\n`;
  output += `URL: ${dom.url}\n`;
  if (dom.metaDescription) {
    output += `Description: ${dom.metaDescription}\n`;
  }
  output += `\n### Page Summary\n`;
  output += `- Total elements: ${dom.summary.totalElements}\n`;
  output += `- Interactive elements: ${dom.summary.interactiveElements}\n`;
  output += `- Headings: ${dom.summary.headings}, Links: ${dom.summary.links}, Buttons: ${dom.summary.buttons}, Inputs: ${dom.summary.inputs}\n`;
  output += `\n### Interactive Elements (use these selectors for actions)\n`;

  // Filter to interactive and visible elements, limit count
  const interactiveElements = dom.elements
    .filter(el => el.isInteractive && el.isVisible)
    .slice(0, maxElements);

  for (const el of interactiveElements) {
    let line = `[${el.index}] <${el.tag}`;
    if (el.type) line += ` type="${el.type}"`;
    if (el.role) line += ` role="${el.role}"`;
    line += `> selector="${el.selector}"`;

    if (el.text) line += ` text="${el.text.substring(0, 50)}${el.text.length > 50 ? '...' : ''}"`;
    if (el.placeholder) line += ` placeholder="${el.placeholder}"`;
    if (el.ariaLabel) line += ` aria-label="${el.ariaLabel}"`;
    if (el.href) line += ` href="${el.href.substring(0, 60)}${el.href.length > 60 ? '...' : ''}"`;
    if (el.options) line += ` options=[${el.options.slice(0, 5).join(', ')}${el.options.length > 5 ? '...' : ''}]`;

    output += line + "\n";
  }

  if (dom.elements.length > maxElements) {
    output += `\n... and ${dom.elements.length - maxElements} more elements\n`;
  }

  // Add page text excerpt for context
  if (dom.fullText) {
    const textExcerpt = dom.fullText.substring(0, 2000);
    output += `\n### Page Text Content (excerpt)\n${textExcerpt}${dom.fullText.length > 2000 ? '...' : ''}\n`;
  }

  return output;
}

// Compress/resize base64 image if needed (placeholder - in production you'd actually resize)
function validateScreenshot(screenshot: string): string | null {
  if (!screenshot) {
    console.log("No screenshot provided");
    return null;
  }

  // Check if it's a valid data URL
  if (!screenshot.startsWith("data:image/")) {
    console.log("Invalid screenshot format - doesn't start with data:image/");
    return null;
  }

  // Check if it has the base64 part
  const base64Match = screenshot.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!base64Match) {
    console.log("Invalid screenshot format - can't parse base64");
    return null;
  }

  const [, imageType, base64Data] = base64Match;
  console.log(`Screenshot valid: type=${imageType}, base64Length=${base64Data.length}`);

  // If the image is very large, we might want to warn (but still use it)
  if (base64Data.length > 1000000) {
    console.log("Warning: Large screenshot, may affect performance");
  }

  return screenshot;
}

// Build the human message with screenshot and context
function buildHumanMessage(
  message: string,
  pageState: PageState,
  isFollowUp: boolean = false
): HumanMessage {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" | "low" | "auto" } }
  > = [];

  // Add context about what this message is
  if (isFollowUp) {
    content.push({
      type: "text",
      text: `[OBSERVATION AFTER ACTIONS]\nThe previous actions have been executed. Here is the current state of the page:\n\nURL: ${pageState.url}`,
    });
  } else {
    content.push({
      type: "text",
      text: `User Request: ${message}\n\nCurrent Page URL: ${pageState.url}`,
    });
  }

  // Add the screenshot
  const validScreenshot = validateScreenshot(pageState.screenshot);
  if (validScreenshot) {
    content.push({
      type: "image_url",
      image_url: {
        url: validScreenshot,
        detail: "high", // Use high detail for better element identification
      },
    });

    content.push({
      type: "text",
      text: "Above is a screenshot of the current webpage. Analyze it carefully to identify interactive elements, their positions, and visual context.",
    });
  } else {
    content.push({
      type: "text",
      text: "[No screenshot available - relying on page structure only]",
    });
  }

  // Add the structured page content (distilled DOM)
  const pageStructure = formatDistilledDOM(pageState.distilledDOM);
  content.push({
    type: "text",
    text: `\n### Page Structure\n${pageStructure}`,
  });

  // Add instructions for next steps
  if (isFollowUp) {
    content.push({
      type: "text",
      text: "\nAnalyze the current state. Did the previous actions work? What should be done next to complete the user's task?",
    });
  } else {
    content.push({
      type: "text",
      text: "\nAnalyze the page and determine what actions are needed. If this is a multi-step task, start with the first action and use request_observation to see results.",
    });
  }

  return new HumanMessage({ content });
}

// Main function to process user requests
export async function processUserRequest(
  message: string,
  pageState: PageState,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<{
  actions: ConversationAction[];
  complete: boolean;
  needsObservation: boolean;
  conversationId?: string;
}> {
  console.log("=== Processing User Request ===");
  console.log("Message:", message);
  console.log("URL:", pageState.url);
  console.log("Has screenshot:", !!pageState.screenshot);
  console.log("Has distilledDOM:", !!pageState.distilledDOM);
  console.log("Element count:", pageState.distilledDOM?.elements?.length || 0);
  console.log("Conversation history length:", conversationHistory.length);

  const agent = createAgent();

  // Build messages array
  const messages: Array<SystemMessage | HumanMessage | AIMessage> = [
    new SystemMessage(SYSTEM_PROMPT),
  ];

  // Add conversation history if this is a follow-up
  const isFollowUp = conversationHistory.length > 0;

  // Add the current observation
  messages.push(buildHumanMessage(message, pageState, isFollowUp));

  try {
    console.log("Invoking agent with", messages.length, "messages");

    // Invoke the model with tools
    const response = await agent.invoke(messages);

    console.log("Agent response received");
    console.log("Tool calls:", response.tool_calls?.length || 0);
    console.log("Content:", typeof response.content === 'string' ? response.content.substring(0, 200) : 'complex content');

    // Extract tool calls from the response
    const toolCalls = response.tool_calls || [];

    // Transform tool calls to actions
    const actions: ConversationAction[] = toolCalls.map(toolCallToAction);

    // Check if the task is complete
    const complete = actions.some(
      (action) => action.action_type === "complete"
    );

    // Check if the agent wants to observe the page after actions
    const needsObservation = actions.some(
      (action) => (action as any).action_type === "request_observation"
    );

    // Filter out the request_observation action from the returned actions
    const executableActions = actions.filter(
      (action) => (action as any).action_type !== "request_observation"
    );

    // If no actions were generated, create a message action from the response
    if (executableActions.length === 0 && response.content) {
      const textContent = typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content
              .filter((c): c is { type: "text"; text: string } =>
                typeof c === "object" && "type" in c && c.type === "text"
              )
              .map(c => c.text)
              .join("\n")
          : "";

      if (textContent) {
        executableActions.push({
          action_type: "message",
          message: textContent,
          timestamp: new Date().toISOString(),
        });
      }
    }

    console.log("Returning", executableActions.length, "actions, complete:", complete, "needsObservation:", needsObservation);

    return {
      actions: executableActions,
      complete,
      needsObservation: needsObservation && !complete,
    };
  } catch (error) {
    console.error("Error processing request:", error);

    return {
      actions: [
        {
          action_type: "message",
          message: `I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
          timestamp: new Date().toISOString(),
        },
      ],
      complete: false,
      needsObservation: false,
    };
  }
}
