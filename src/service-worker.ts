import { ContextMenu, MessageAction, MESSAGE_RETRY_CONFIG, type ContextMenuValue } from "./constants";
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
chrome.runtime.onInstalled.addListener(async (details) => {
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
    id: ContextMenu.Simplify,
    parentId: ContextMenu.AskMyAi,
    title: "ELI5 (Simplify)",
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

        // [don't] Add CORS headers
        // { header: "access-control-allow-origin", operation: "set", value: "*" },
        // { header: "access-control-allow-methods", operation: "set", value: "*" },
        // { header: "access-control-allow-headers", operation: "set", value: "*" },
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

  // Open popup on first install
  if (details.reason === "install") {
    try {
      await chrome.action.openPopup();
    } catch (error) {
      // Fallback: If popup fails (e.g., no active window), open in new tab
      logger.error("Failed to open popup, opening in new tab instead:", error);
      await chrome.tabs.create({
        url: chrome.runtime.getURL("popup.html"),
      });
    }
  }
});

// Update context menu on startup
chrome.runtime.onStartup.addListener(updateContextMenu);

// Listen for storage changes and update context menu
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.selectedAI) {
    updateContextMenu();
  }
});

// Helper function to get selected text from active tab
async function getSelectedText(tabId: number): Promise<string | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.getSelection()?.toString() || null,
    });
    return results[0]?.result || null;
  } catch (error) {
    logger.error("Error getting selected text:", error);
    return null;
  }
}

// Handle keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "open-side-panel") {
    try {
      if (!tab || !tab.id) {
        throw new Error("tab is undefined");
      }

      // Open side panel first
      if (tab.windowId > 0) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }

      // Try to get selected text
      const selectedText = await getSelectedText(tab.id);

      if (selectedText) {
        await sendTextToSidePanel(selectedText, tab, ContextMenu.AskMyAi);
      }
    } catch (error) {
      logger.error("Error opening side panel via keyboard shortcut:", error);
    }
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  const validMenuIds = Object.values(ContextMenu);

  if (typeof info.menuItemId !== "string") {
    logger.error("menuItemId is not a string");
    return;
  }

  if (validMenuIds.includes(info.menuItemId as ContextMenuValue)) {
    try {
      if (!tab) {
        throw new Error("tab is undefined");
      }

      // Open side panel
      if (tab.windowId > 0) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }

      if (!info.selectionText) {
        logger.error("No selection text found.");
        return;
      }

      await sendTextToSidePanel(info.selectionText, tab, info.menuItemId as ContextMenuValue);
    } catch (error) {
      logger.error("Error handling Ask my AI:", error);
    }
  }
});

async function sendTextToSidePanel(text: string, tab: chrome.tabs.Tab, formatType: ContextMenuValue) {
  const selectionInfo: SelectionInfo = {
    text: formatSelectionText(text, tab, formatType),
    tabUrl: tab.url || "unknown",
    tabTitle: tab.title || "Untitled",
    timestamp: Date.now(),
  };

  // save selection info in storage
  await ExtStorage.session.setSelectionInfo(selectionInfo);

  // send selection info to side panel with retry logic
  let sent = false;
  let i = 0;
  for (; i < MESSAGE_RETRY_CONFIG.MAX_ATTEMPTS; ++i) {
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
      await new Promise((resolve) => setTimeout(resolve, MESSAGE_RETRY_CONFIG.RETRY_DELAY_MS));
    }
  }

  if (!sent) {
    logger.error(`Failed to send selection info to side panel after ${i} attempts`);
  }
}

function formatSelectionText(text: string, tab: chrome.tabs.Tab, menuItemId: ContextMenuValue) {
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

    case ContextMenu.Simplify:
      formatted = `${baseContext}

Explain this like I'm 5 (ELI5) - use simple language and everyday examples:

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
