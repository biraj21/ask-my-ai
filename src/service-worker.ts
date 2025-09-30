import type { PortConnection, SelectionInfo } from "./types";

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: "ask-my-ai",
    title: "Ask my AI",
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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  if (info.menuItemId === "ask-my-ai") {
    try {
      if (!tab) {
        throw new Error("tab is undefined");
      }

      // Open side panel
      await chrome.sidePanel.open({ windowId: tab.windowId });

      if (!info.selectionText) {
        console.log("No selection text found.");
        return;
      }

      const prevResult = await chrome.storage.session.get("selectionInfo");
      const selectedAIResult = await chrome.storage.local.get("selectedAI");

      const selectionInfo: SelectionInfo = {
        text: formatSelectionText(info.selectionText, tab),
        tabUrl: tab.url || "wtf",
        tabTitle: tab.title || "wtf",
        timestamp: Date.now(),
        previousAi: prevResult.selectionInfo?.currentAi || null,
        currentAi: selectedAIResult.selectedAI || null,
      };

      chrome.storage.session.set({ selectionInfo: selectionInfo });

      for (const connection of activeConnections) {
        console.debug(`Sending selection text via port for tab ${tab.url}`);
        connection.port.postMessage({
          action: "getSelection",
          selectionInfo,
        });
      }
    } catch (error) {
      console.error("Error handling Ask my AI:", error);
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

// Store active connections
const activeConnections = new Set<PortConnection>();

// Listen for connections from content scripts
chrome.runtime.onConnect.addListener(async (port) => {
  console.debug("New connection:", port);

  if (port.name !== "content-background-port") {
    return;
  }

  // Store the connection with tab info

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  const connection: PortConnection = {
    port,
    tabUrl: tab.url || "wtf",
    tabTitle: tab.title || "wtf",
    connectedAt: Date.now(),
  };

  activeConnections.add(connection);

  // send connection acknowledgment
  port.postMessage({ action: "connected", info: connection });

  // Listen for messages from this content script
  port.onMessage.addListener(async (message) => {
    console.debug("Received message from content script:", message);

    switch (message.action) {
      case "getSelection":
        const result = await chrome.storage.session.get("selectionInfo");
        const selectedAIResult = await chrome.storage.local.get("selectedAI");

        if (result.selectionInfo) {
          const selectionInfo: SelectionInfo = {
            ...result.selectionInfo,
            previousAi: result.selectionInfo.currentAi || null,
            currentAi: selectedAIResult.selectedAI || null,
          };

          // Send response back through the port
          port.postMessage({
            action: "getSelection",
            selectionInfo,
          });
        }

        break;
    }
  });

  // Handle disconnect
  port.onDisconnect.addListener(() => {
    console.debug(`Connection disconnected for port ${port}`);
    activeConnections.delete(connection);
    console.debug(`Active connections: ${activeConnections.size}`);
  });
});
