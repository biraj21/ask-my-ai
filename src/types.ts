export interface PortMessage {
  action: string;
}

export type AiType = "chatgpt" | "claude" | "google" | "gemini" | "scira" | "deepseek" | "mistral";
export type AiConfig = {
  label: string;
  url: string;
};

export interface SelectionInfo {
  text: string;
  tabUrl: string;
  tabTitle: string;
  timestamp: number;
  currentAi: AiType | null;
  previousAi: AiType | null;
}

export interface PortConnection {
  port: chrome.runtime.Port;
  tabUrl: string;
  tabTitle: string;
  connectedAt: number;
}
