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

    /**
     * List of enabled AI providers for the side panel.
     * If not set, all AIs are considered enabled.
     */
    getEnabledAIs: async (): Promise<AiType[] | null> => {
      const { enabledAIs } = await chrome.storage.local.get("enabledAIs");
      if (Array.isArray(enabledAIs)) {
        return enabledAIs as AiType[];
      }
      return null;
    },

    setEnabledAIs: (enabledAIs: AiType[]) => {
      return chrome.storage.local.set({ enabledAIs });
    },

    /**
     * Global toggle for the floating selection button.
     * Defaults to true when not explicitly set.
     */
    getSelectionButtonEnabled: async (): Promise<boolean> => {
      const { selectionButtonEnabled } = await chrome.storage.local.get("selectionButtonEnabled");
      if (typeof selectionButtonEnabled === "boolean") {
        return selectionButtonEnabled;
      }
      return true;
    },

    setSelectionButtonEnabled: (enabled: boolean) => {
      return chrome.storage.local.set({ selectionButtonEnabled: enabled });
    },
  },

  session: {
    getSelectionInfo: async function (ttl = 3 * 60 * 1_000): Promise<SelectionInfo | null> {
      const { selectionInfo } = await chrome.storage.session.get("selectionInfo");
      if (!selectionInfo) {
        return null;
      } else {
        if (Date.now() - (selectionInfo as SelectionInfo).timestamp > ttl) {
          this.removeSelectionInfo();
          return null;
        }

        return selectionInfo;
      }
    },
    setSelectionInfo: (selectionInfo: SelectionInfo) => {
      return chrome.storage.session.set({ selectionInfo });
    },
    removeSelectionInfo: () => {
      return chrome.storage.session.remove("selectionInfo");
    },

    getPanelOpenState: async (): Promise<boolean> => {
      const result = await chrome.storage.session.get("panelOpen");
      return result.panelOpen === true;
    },
    setPanelOpenState: (isOpen: boolean) => {
      return chrome.storage.session.set({ panelOpen: isOpen });
    },
  },
};
