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

  // Child menu items (submenus)
  chrome.contextMenus.create({
    id: ContextMenu.Explain,
    parentId: ContextMenu.AskMyAi, // This creates the nesting
    title: "Explain",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: ContextMenu.Summarize,
    parentId: ContextMenu.AskMyAi,
    title: "Summarize",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: ContextMenu.QuizMe,
    parentId: ContextMenu.AskMyAi,
    title: "Quiz Me",
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
  const validMenuIds = [ContextMenu.AskMyAi, ContextMenu.Explain, ContextMenu.Summarize, ContextMenu.QuizMe];

  if (typeof info.menuItemId !== "string") {
    logger.error("menuItemId is not a string");
    return;
  }

  if (validMenuIds.includes(info.menuItemId)) {
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
        text: formatSelectionText(info.selectionText, tab, info.menuItemId),
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

function formatSelectionText(text: string, tab: chrome.tabs.Tab, menuItemId: string) {
  const baseContext = `Yo I'm reading this page titled '${tab.title}' at ${tab.url}.`;

  let formatted = "";

  switch (menuItemId) {
    case ContextMenu.Explain:
      formatted = `${baseContext}

Explain this snippet from it:

<snippet>
${text}
</snippet>`;
      break;

    case ContextMenu.Summarize:
      formatted = `${baseContext}

Summarize the key points from this text. Use formatting (headers, bullets, etc.) to make it easy to scan. Be concise but don't lose important details.

<snippet>
${text}
</snippet>`;
      break;

    case ContextMenu.QuizMe:
      formatted = `${baseContext}

Create a quiz to test my understanding of this text. Ask one question at a time and wait for my answer before continuing. Use a mix of question types: multiple choice, true/false, and short answer.

<snippet>
${text}
</snippet>`;
      break;

    default:
      // Default case for parent menu or unknown
      formatted = `${baseContext}
      
Read the page and help me understand this snippet:

<snippet>
${text}
</snippet>`;
      break;
  }

  return formatted;
}
