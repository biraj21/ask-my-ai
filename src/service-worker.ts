import { ContextMenu, MessageAction } from "./constants";
import { logger } from "./logger";
import type { SelectionInfo, SelectionInfoSavedMessage } from "./types";
import { ExtStorage } from "./storage";

const contextMenuTitleWithSelectedAi = async () => {
  const selectedAI = await ExtStorage.local.getSelectedAI();
  return selectedAI ? `Ask my AI (${selectedAI})` : "Ask my AI";
};

// Function to update context menu text
const updateContextMenu = async () => {
  chrome.contextMenus.update(ContextMenu.AskMyAi, {
    title: await contextMenuTitleWithSelectedAi(),
  });
};

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: ContextMenu.AskMyAi,
    title: await contextMenuTitleWithSelectedAi(),
    contexts: ["selection"],
  });

  const rule: chrome.declarativeNetRequest.Rule = {
    id: 1,
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        { header: "frame-options", operation: "remove" },
        { header: "x-frame-options", operation: "remove" },
        { header: "content-security-policy", operation: "remove" },

        // Add CORS headers
        { header: "access-control-allow-origin", operation: "set", value: "*" },
        { header: "access-control-allow-methods", operation: "set", value: "*" },
        { header: "access-control-allow-headers", operation: "set", value: "*" },
      ],
    },
    condition: {
      urlFilter: "|*://*/*",
      resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "websocket"],
    },
  };
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [rule],
  });
});

// Update context menu on startup
chrome.runtime.onStartup.addListener(updateContextMenu);

// Listen for storage changes and update context menu
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.selectedAI) {
    updateContextMenu();
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  if (info.menuItemId === ContextMenu.AskMyAi) {
    try {
      if (!tab) {
        throw new Error("tab is undefined");
      }

      // Open side panel
      await chrome.sidePanel.open({ windowId: tab.windowId });

      if (!info.selectionText) {
        logger.error("No selection text found.");
        return;
      }

      const selectionInfo: SelectionInfo = {
        text: formatSelectionText(info.selectionText, tab),
        tabUrl: tab.url || "wtf",
        tabTitle: tab.title || "wtf",
        timestamp: Date.now(),
      };

      // save selection info in storage
      await ExtStorage.session.setSelectionInfo(selectionInfo);

      // send selection info to side panel
      let sent = false;
      let i = 0;
      for (; i < 5; ++i) {
        try {
          logger.debug(`Sending selection info to side panel (attempt ${i + 1})`);
          const msg: SelectionInfoSavedMessage = {
            action: MessageAction.SELECTION_INFO_SAVED,
            selectionInfo,
          };
          await chrome.runtime.sendMessage(msg);
          sent = true;
          break;
        } catch (error) {
          logger.error("Error sending selection info to side panel:", error);
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      if (!sent) {
        logger.error(`Failed to send selection info to side panel after ${i} attempts`);
      }
    } catch (error) {
      logger.error("Error handling Ask my AI:", error);
    }
  }
});

function formatSelectionText(text: string, tab: chrome.tabs.Tab) {
  const formatted = `hey i'm reading this blog at ${tab.url} with title '${tab.title}'. read the blog and explain this snippet from it:
"""
${text}
"""
`;

  return formatted;
}
