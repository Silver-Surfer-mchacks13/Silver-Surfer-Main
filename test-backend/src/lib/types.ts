// Types mirrored from the Plasmo extension for compatibility

export type ActionType =
  | "click"
  | "wait"
  | "message"
  | "complete"
  | "highlight"
  | "remove_highlights"
  | "magnify"
  | "reset_magnification"
  | "scroll"
  | "fill_form"
  | "select_dropdown"
  | "remove_clutter"
  | "restore_clutter"
  | "remove_fraud_popup";

interface BaseAction {
  timestamp: string;
  reasoning?: string;
}

export interface ClickAction extends BaseAction {
  action_type: "click";
  x_path: string; // CSS selector or XPath
}

export interface WaitAction extends BaseAction {
  action_type: "wait";
  duration: number;
}

export interface MessageAction extends BaseAction {
  action_type: "message";
  message: string;
}

export interface CompleteAction extends BaseAction {
  action_type: "complete";
  message: string;
}

export interface HighlightAction extends BaseAction {
  action_type: "highlight";
  selector: string;
}

export interface RemoveHighlightsAction extends BaseAction {
  action_type: "remove_highlights";
}

export interface MagnifyAction extends BaseAction {
  action_type: "magnify";
  selector: string;
  scale_factor?: number;
}

export interface ResetMagnificationAction extends BaseAction {
  action_type: "reset_magnification";
}

export interface ScrollAction extends BaseAction {
  action_type: "scroll";
  selector: string;
}

export interface FillFormAction extends BaseAction {
  action_type: "fill_form";
  selector: string;
  value: string;
}

export interface SelectDropdownAction extends BaseAction {
  action_type: "select_dropdown";
  selector: string;
  value: string;
}

export interface RemoveClutterAction extends BaseAction {
  action_type: "remove_clutter";
}

export interface RestoreClutterAction extends BaseAction {
  action_type: "restore_clutter";
}

export interface RemoveFraudPopupAction extends BaseAction {
  action_type: "remove_fraud_popup";
  selector: string;
  overlay_text?: string;
}

export type ConversationAction =
  | ClickAction
  | WaitAction
  | MessageAction
  | CompleteAction
  | HighlightAction
  | RemoveHighlightsAction
  | MagnifyAction
  | ResetMagnificationAction
  | ScrollAction
  | FillFormAction
  | SelectDropdownAction
  | RemoveClutterAction
  | RestoreClutterAction
  | RemoveFraudPopupAction;

export interface PageState {
  url: string;
  html: string;
  screenshot: string; // Base64 data URL
}

export interface ConversationRequest {
  session_id?: string;
  title: string;
  message: string;  // The actual user message
  page_state: PageState;
}

export interface ConversationResponse {
  session_id: string;
  actions: ConversationAction[];
  complete: boolean;
}
