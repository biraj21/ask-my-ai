import type { AiType, AiConfig } from "./types";

const ICON_BASE_PATH = "public/brands";

export const URLs: Record<AiType, AiConfig> = {
  chatgpt: {
    label: "ChatGPT",
    url: "https://chatgpt.com/",
    icon: `${ICON_BASE_PATH}/openai.svg`,
  },
  claude: {
    label: "Claude",
    url: "https://claude.ai/new",
    icon: `${ICON_BASE_PATH}/claude-color.svg`,
  },
  gemini: {
    label: "Gemini",
    url: "https://gemini.google.com/",
    icon: `${ICON_BASE_PATH}/gemini-color.svg`,
  },
  aistudio: {
    label: "Google AI Studio",
    url: "https://aistudio.google.com/",
    icon: `${ICON_BASE_PATH}/aistudio.svg`,
  },
  scira: {
    label: "Scira",
    url: "https://scira.ai/",
    icon: `${ICON_BASE_PATH}/scira.svg`,
  },
  deepseek: {
    label: "Deepseek",
    url: "https://chat.deepseek.com/",
    icon: `${ICON_BASE_PATH}/deepseek-color.svg`,
  },
  google: {
    label: "Google ",
    url: "https://google.com/",
    icon: `${ICON_BASE_PATH}/google-color.svg`,
  },
  perplexity: {
    label: "Perplexity",
    url: "https://perplexity.ai/",
    icon: `${ICON_BASE_PATH}/perplexity-color.svg`,
  },
  mistral: {
    label: "Mistral Le Chat",
    url: "https://chat.mistral.ai/chat",
    icon: `${ICON_BASE_PATH}/mistral-color.svg`,
  },
};

export const ContextMenu = {
  AskMyAi: "ask-my-ai",
  Explain: "explain",
  Summarize: "summarize",
  Simplify: "simplify",
} as const;

export type ContextMenuValue = (typeof ContextMenu)[keyof typeof ContextMenu];

export const MessageAction = {
  /**
   * Iframe content script must send this to the side panel to initiate handshake.
   */
  EXT_IFRAME_HANDSHAKE_INIT: "EXT_IFRAME_HANDSHAKE_INIT",

  /**
   * Side panel must send this to the iframe content script to respond to handshake.
   */
  EXT_IFRAME_HANDSHAKE_RESP: "EXT_IFRAME_HANDSHAKE_RESP",

  /**
   * Service worker must save selection info to storage and send this to the side panel to forward
   * it to the iframe content script.
   */
  SELECTION_INFO_SAVED: "SELECTION_INFO_SAVED",

  /**
   * Service worker must send this to the side panel to trigger selection info request.
   */
  SELECTION_INFO_REQ: "SELECTION_INFO_REQ",

  /**
   * Side panel must send this to the iframe content script to respond to selection info request.
   */
  SELECTION_INFO_RESP: "SELECTION_INFO_RESP",
};

export const EXT_NAME = "Ask my AI";
