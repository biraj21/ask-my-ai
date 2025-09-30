import type { SelectionInfo } from "./types";

export const ExtStorage = {
  local: {
    getSelectedAI: async () => {
      const { selectedAI } = await chrome.storage.local.get("selectedAI");
      return selectedAI;
    },

    setSelectedAI: (selectedAI: string) => {
      return chrome.storage.local.set({ selectedAI });
    },
  },

  session: {
    getSelectionInfo: async () => {
      const { selectionInfo } = await chrome.storage.session.get("selectionInfo");
      return selectionInfo;
    },
    setSelectionInfo: (selectionInfo: SelectionInfo) => {
      return chrome.storage.session.set({ selectionInfo });
    },
  },
};
