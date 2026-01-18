import { z } from "zod";
import { tool } from "@langchain/core/tools";

// Tool schemas that mirror the page-actions.ts capabilities
// These are "virtual tools" - they don't execute here, they guide the LLM

export const clickElementSchema = z.object({
  selector: z.string().describe("The CSS selector of the element to click (e.g., '#submit-btn', '.login-button', 'button[type=\"submit\"]')"),
  reasoning: z.string().optional().describe("Brief explanation of why this element should be clicked"),
});

export const highlightElementSchema = z.object({
  selector: z.string().describe("The CSS selector of the element to highlight with a visual border"),
  reasoning: z.string().optional().describe("Why this element is being highlighted for the user"),
});

export const removeHighlightsSchema = z.object({
  reasoning: z.string().optional().describe("Why highlights are being removed"),
});

export const magnifyTextSchema = z.object({
  selector: z.string().describe("The CSS selector of the element whose text should be magnified"),
  scale_factor: z.number().default(1.3).describe("Magnification scale factor (default 1.3, recommended range 1.2-1.5)"),
  reasoning: z.string().optional().describe("Why this text is being magnified"),
});

export const resetMagnificationSchema = z.object({
  reasoning: z.string().optional().describe("Why magnification is being reset"),
});

export const scrollToViewSchema = z.object({
  selector: z.string().describe("The CSS selector of the element to scroll into view"),
  reasoning: z.string().optional().describe("Why scrolling to this element"),
});

export const fillFormFieldSchema = z.object({
  selector: z.string().describe("The CSS selector of the input field to fill"),
  value: z.string().describe("The text value to enter into the field"),
  reasoning: z.string().optional().describe("Why this field is being filled"),
});

export const selectDropdownSchema = z.object({
  selector: z.string().describe("The CSS selector of the dropdown/select element"),
  value: z.string().describe("The option value or text to select"),
  reasoning: z.string().optional().describe("Why this option is being selected"),
});

export const removeClutterSchema = z.object({
  reasoning: z.string().optional().describe("Why clutter is being removed from the page"),
});

export const restoreClutterSchema = z.object({
  reasoning: z.string().optional().describe("Why clutter is being restored"),
});

export const removeFraudPopupSchema = z.object({
  selector: z.string().describe("The CSS selector of the fraudulent popup container to remove"),
  overlay_text: z
    .string()
    .default("Fraudulent popup removed by Silver Surfer.")
    .describe("Optional custom overlay message to reassure the user"),
  reasoning: z.string().optional().describe("Why this popup is deemed fraudulent"),
});

export const waitSchema = z.object({
  duration: z.number().describe("Duration to wait in milliseconds"),
  reasoning: z.string().optional().describe("Why waiting is necessary"),
});

export const sendMessageSchema = z.object({
  message: z.string().describe("A helpful message to display to the user explaining what's happening or providing guidance"),
});

export const completeTaskSchema = z.object({
  message: z.string().describe("A completion message summarizing what was accomplished"),
});

// Create LangChain tools

export const clickElementTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "click_element", ...input });
  },
  {
    name: "click_element",
    description: "Click a button, link, or interactive element on the page. Use this to navigate, submit forms, or interact with the page. IMPORTANT: Cannot click payment/purchase/delete/logout buttons for safety.",
    schema: clickElementSchema,
  }
);

export const highlightElementTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "highlight_element", ...input });
  },
  {
    name: "highlight_element",
    description: "Draw a prominent visual border around an element to help the user locate it. Great for showing users where to look or what to interact with.",
    schema: highlightElementSchema,
  }
);

export const removeHighlightsTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "remove_highlights", ...input });
  },
  {
    name: "remove_highlights",
    description: "Remove all visual highlights from the page.",
    schema: removeHighlightsSchema,
  }
);

export const magnifyTextTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "magnify_text", ...input });
  },
  {
    name: "magnify_text",
    description: "Increase the font size of text to make it easier to read. Useful for elderly users or small text.",
    schema: magnifyTextSchema,
  }
);

export const resetMagnificationTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "reset_magnification", ...input });
  },
  {
    name: "reset_magnification",
    description: "Reset all magnified text back to original size.",
    schema: resetMagnificationSchema,
  }
);

export const scrollToViewTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "scroll_to_view", ...input });
  },
  {
    name: "scroll_to_view",
    description: "Smoothly scroll the page so a specific element is centered and visible. Also briefly highlights the element.",
    schema: scrollToViewSchema,
  }
);

export const fillFormFieldTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "fill_form_field", ...input });
  },
  {
    name: "fill_form_field",
    description: "Type text into an input field or textarea. IMPORTANT: Cannot fill password or credit card fields for security.",
    schema: fillFormFieldSchema,
  }
);

export const selectDropdownTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "select_dropdown", ...input });
  },
  {
    name: "select_dropdown",
    description: "Select an option from a dropdown menu by value or visible text.",
    schema: selectDropdownSchema,
  }
);

export const removeClutterTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "remove_clutter", ...input });
  },
  {
    name: "remove_clutter",
    description: "Hide distracting elements like ads, popups, cookie banners, and auto-playing videos to focus on main content.",
    schema: removeClutterSchema,
  }
);

export const restoreClutterTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "restore_clutter", ...input });
  },
  {
    name: "restore_clutter",
    description: "Restore previously hidden elements.",
    schema: restoreClutterSchema,
  }
);

export const removeFraudPopupTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "remove_fraud_popup", ...input });
  },
  {
    name: "remove_fraud_popup",
    description:
      "Remove or hide a clearly fraudulent popup and add a gentle overlay letting the user know Silver Surfer removed it.",
    schema: removeFraudPopupSchema,
  }
);

export const waitTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "wait", ...input });
  },
  {
    name: "wait",
    description: "Wait for a specified duration before the next action. Useful after clicks to let pages load.",
    schema: waitSchema,
  }
);

export const sendMessageTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "send_message", ...input });
  },
  {
    name: "send_message",
    description: "Send a helpful message to the user explaining what's happening, providing instructions, or offering guidance. Use this to communicate with the user.",
    schema: sendMessageSchema,
  }
);

export const completeTaskTool = tool(
  async (input) => {
    return JSON.stringify({ tool: "complete_task", ...input });
  },
  {
    name: "complete_task",
    description: "Mark the task as complete and provide a summary message. Use this when the user's request has been fulfilled.",
    schema: completeTaskSchema,
  }
);

// Export all tools as an array
export const allTools = [
  clickElementTool,
  highlightElementTool,
  removeHighlightsTool,
  magnifyTextTool,
  resetMagnificationTool,
  scrollToViewTool,
  fillFormFieldTool,
  selectDropdownTool,
  removeClutterTool,
  restoreClutterTool,
  removeFraudPopupTool,
  waitTool,
  sendMessageTool,
  completeTaskTool,
];
