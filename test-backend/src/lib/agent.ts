import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { allTools } from "./tools";
import type { ConversationAction, PageState } from "./types";

// System prompt for Silver Surfer agent
const SYSTEM_PROMPT = `You are Silver Surfer, a friendly and patient AI assistant designed to help elderly users navigate the web. Your purpose is to make the internet more accessible and less overwhelming.

## Your Personality
- Patient, warm, and encouraging
- Explain things in simple, clear terms without being condescending
- Celebrate small successes with the user
- Proactively offer help when you notice potential confusion

## Core Capabilities
You can perform these actions on the user's behalf:
1. **Click elements** - Navigate by clicking buttons and links (except payment/security-sensitive buttons)
2. **Fill forms** - Enter text into fields (except passwords/credit cards)
3. **Select dropdowns** - Choose options from menus
4. **Highlight elements** - Draw attention to important UI elements
5. **Magnify text** - Make small text larger and more readable
6. **Scroll** - Bring important content into view
7. **Remove clutter** - Hide distracting ads, popups, and banners
8. **Remove fraudulent popups** - Immediately hide scams and reassure the user with a gentle overlay
9. **Send messages** - Communicate explanations and guidance

## Important Guidelines
1. **Safety First**: Never perform financial transactions, deletions, or account changes without explicit user consent
2. **One Step at a Time**: Break complex tasks into small, manageable steps
3. **Visual Guidance**: Use highlight and magnify to help users see what you're referring to
4. **Explain Actions**: Always tell the user what you're doing and why
5. **Confirm Sensitive Actions**: Ask before any action that could have unintended consequences

## Context
You receive:
- A screenshot of the current webpage
- The page HTML structure
- The user's message or request

Analyze both the visual screenshot AND the HTML to understand the page. Use CSS selectors from the HTML to target elements.

## Response Format
Use the available tools to fulfill the user's request. Always include a message tool call to explain what you're doing. End with complete_task when finished.`;

// Initialize the model with tool binding
function createAgent() {
  const model = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-4o",
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
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
    remove_fraud_popup: "remove_fraud_popup",
    wait: "wait",
    send_message: "message",
    complete_task: "complete",
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

    case "remove_fraud_popup":
      return {
        action_type: "remove_fraud_popup",
        selector: args.selector as string,
        overlay_text: args.overlay_text as string | undefined,
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

    default:
      // Fallback to message action
      return {
        action_type: "message",
        message: `Unknown action: ${actionType}`,
        timestamp,
      };
  }
}

// Truncate HTML to fit context window while preserving structure
function truncateHTML(html: string, maxLength: number = 50000): string {
  if (html.length <= maxLength) return html;

  // Try to cut at a reasonable point (end of a tag)
  const truncated = html.substring(0, maxLength);
  const lastTagEnd = truncated.lastIndexOf(">");

  if (lastTagEnd > maxLength - 1000) {
    return truncated.substring(0, lastTagEnd + 1) + "\n<!-- ... HTML truncated ... -->";
  }

  return truncated + "\n<!-- ... HTML truncated ... -->";
}

// Main function to process user requests
export async function processUserRequest(
  message: string,
  pageState: PageState
): Promise<{ actions: ConversationAction[]; complete: boolean }> {
  // Debug logging
  console.log("Processing user request:", {
    message,
    hasScreenshot: !!pageState.screenshot,
    screenshotPrefix: pageState.screenshot?.substring(0, 50),
    htmlLength: pageState.html?.length || 0,
    url: pageState.url
  });

  const agent = createAgent();

  // Build the message content with vision support
  const humanMessageContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: string } }
  > = [];

  // Add the user's message
  humanMessageContent.push({
    type: "text",
    text: `User Request: ${message}`,
  });

  // Add the screenshot if available
  if (pageState.screenshot && pageState.screenshot.startsWith("data:")) {
    console.log("Adding screenshot to request");
    humanMessageContent.push({
      type: "image_url",
      image_url: {
        url: pageState.screenshot,
        detail: "high", // Use high detail for better element identification
      },
    });
  } else {
    console.log("No valid screenshot available:", pageState.screenshot?.substring(0, 30));
  }

  // Add the page context
  humanMessageContent.push({
    type: "text",
    text: `
Current Page URL: ${pageState.url}

Page HTML Structure (use CSS selectors from this to target elements):
${truncateHTML(pageState.html)}
`,
  });

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage({ content: humanMessageContent }),
  ];

  try {
    // Invoke the model with tools
    const response = await agent.invoke(messages);

    // Extract tool calls from the response
    const toolCalls = response.tool_calls || [];

    // Transform tool calls to actions
    const actions: ConversationAction[] = toolCalls.map(toolCallToAction);

    // Check if the task is complete
    const complete = actions.some(
      (action) => action.action_type === "complete"
    );

    // If no actions were generated, create a message action from the response
    if (actions.length === 0 && response.content) {
      const textContent = typeof response.content === "string"
        ? response.content
        : Array.isArray(response.content)
          ? response.content.filter((c): c is { type: "text"; text: string } => typeof c === "object" && "type" in c && c.type === "text").map(c => c.text).join("\n")
          : "";

      if (textContent) {
        actions.push({
          action_type: "message",
          message: textContent,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { actions, complete };
  } catch (error) {
    console.error("Error processing request:", error);

    // Return an error message action
    return {
      actions: [
        {
          action_type: "message",
          message: `I encountered an error while processing your request. Please try again. ${error instanceof Error ? error.message : ""}`,
          timestamp: new Date().toISOString(),
        },
      ],
      complete: false,
    };
  }
}
