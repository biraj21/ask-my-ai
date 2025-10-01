import type { AiType, SelectionInfo } from "./types";

export const ExtStorage = {
  local: {
    getSelectedAI: async (): Promise<AiType | null> => {
      const { selectedAI } = await chrome.storage.local.get("selectedAI");
      if (typeof selectedAI === "string") {
        return selectedAI as AiType;
      } else {
        return null;
      }
    },

    setSelectedAI: (selectedAI: string) => {
      return chrome.storage.local.set({ selectedAI });
    },

    getPrevSelectedAI: async (): Promise<AiType | null> => {
      const { prevSelectedAI } = await chrome.storage.local.get("prevSelectedAI");
      if (typeof prevSelectedAI === "string") {
        return prevSelectedAI as AiType;
      } else {
        return null;
      }
    },

    setPrevSelectedAI: (prevSelectedAI: string) => {
      return chrome.storage.local.set({ prevSelectedAI });
    },
  },

  session: {
    getSelectionInfo: async (): Promise<SelectionInfo | null> => {
      const { selectionInfo } = await chrome.storage.session.get("selectionInfo");
      if (!selectionInfo) {
        return null;
      } else {
        return selectionInfo;
      }
    },
    setSelectionInfo: (selectionInfo: SelectionInfo) => {
      return chrome.storage.session.set({ selectionInfo });
    },
  },
};
