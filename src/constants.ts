import type { AiType, AiConfig } from "./types";

export const URLs: Record<AiType, AiConfig> = {
  chatgpt: {
    label: "ChatGPT",
    url: "https://chatgpt.com/",
  },
  claude: {
    label: "Claude",
    url: "https://claude.ai/new",
  },
  google: {
    label: "Google ",
    url: "https://google.com/",
  },
  gemini: {
    label: "Gemini",
    url: "https://gemini.google.com/",
  },
  scira: {
    label: "Scira",
    url: "https://scira.ai/",
  },
  deepseek: {
    label: "Deepseek",
    url: "https://chat.deepseek.com/",
  },
  mistral: {
    label: "Mistral Le Chat",
    url: "https://chat.mistral.ai/chat",
  },
};

export const ContextMenu = {
  AskMyAi: "ask-my-ai",
};
