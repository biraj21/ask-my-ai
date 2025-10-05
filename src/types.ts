import type { MessageAction } from "./constants";

export type AiType =
  | "chatgpt"
  | "claude"
  | "google"
  | "gemini"
  | "scira"
  | "deepseek"
  | "mistral"
  | "perplexity"
  | "aistudio";
export type AiConfig = {
  label: string;
  url: string;
  icon: string;
};

export interface SelectionInfo {
  text: string;
  tabUrl: string;
  tabTitle: string;
  timestamp: number;
}

export type SelectionInfoForContent = {
  selectionInfo: SelectionInfo;
  forceInject?: boolean;
  currentAi: AiType;
  previousAi: AiType;
};

interface Message {
  action: (typeof MessageAction)[keyof typeof MessageAction];
}

export interface ExtIframeHandshakeInitMessage extends Message {
  action: typeof MessageAction.EXT_IFRAME_HANDSHAKE_INIT;
  extId: string;
}

export interface ExtIframeHandshakeRespMessage extends Message {
  action: typeof MessageAction.EXT_IFRAME_HANDSHAKE_RESP;
  extId: string;
}

export interface SelectionInfoSavedMessage extends Message {
  action: typeof MessageAction.SELECTION_INFO_SAVED;
  selectionInfo: SelectionInfo;
}

export interface SelectionInfoReqMessage extends Message {
  action: typeof MessageAction.SELECTION_INFO_REQ;
}

export interface SelectionInfoRespMessage extends Message {
  action: typeof MessageAction.SELECTION_INFO_RESP;
  selectionInfo: SelectionInfo;
}

export interface OpenCurrentUrlInTabMessage extends Message {
  action: typeof MessageAction.OPEN_CURRENT_URL_IN_TAB;
}

export interface ReloadIframeMessage extends Message {
  action: typeof MessageAction.RELOAD_IFRAME;
}

export type SidePanelToIframeMessage =
  | ExtIframeHandshakeRespMessage
  | SelectionInfoRespMessage
  | OpenCurrentUrlInTabMessage
  | ReloadIframeMessage;
