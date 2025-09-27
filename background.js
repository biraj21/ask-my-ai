// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: "ask-my-ai",
    title: "Ask my AI",
    contexts: ["selection"],
  });

  const rule = {
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
  if (info.menuItemId === "ask-my-ai" && info.selectionText) {
    try {
      // Open side panel
      await chrome.sidePanel.open({ windowId: tab.windowId });

      // Try to send via port first, fallback to storage
      const connection = activeConnections.get(tab.id);
      if (connection && connection.port) {
        console.log(`Sending selection text via port to tab ${tab.id}`);
        connection.port.postMessage({
          action: "getSelectionText",
          selectionText: formatSelectionText(info.selectionText, connection),
        });
      } else {
        console.log(`No active port connection for tab ${tab.id}, using storage fallback`);
        chrome.storage.session.set({ selectionText: info.selectionText });
      }
    } catch (error) {
      console.error("Error handling Ask AI:", error);
      chrome.storage.session.set({ selectionText: info.selectionText });
    }
  }
});

function formatSelectionText(text, connectionInfo) {
  const formatted = `hey i'm reading this blog at ${connectionInfo.tabUrl} with title '${connectionInfo.tabTitle}'. read the blog and explain this snippet from it:
"""
${text}
"""
`;

  console.log("formatted selection text:", formatted);

  return formatted;
}

// Store active connections
const activeConnections = new Map();

// Listen for connections from content scripts
chrome.runtime.onConnect.addListener(async (port) => {
  console.log("New connection:", port);

  if (port.name !== "content-background-port") {
    return;
  }

  // Store the connection with tab info

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  const connectionInfo = {
    port,
    tabId: tab.id,
    tabUrl: tab.url,
    tabTitle: tab.title,
    id: port.sender.id,
    url: port.sender.url,
    connected: Date.now(),
  };

  activeConnections.set(tab.id, connectionInfo);

  console.log(`Active connections: ${activeConnections.size}`);

  // send connection acknowledgment
  port.postMessage({ action: "connected", info: connectionInfo });

  // Listen for messages from this content script
  port.onMessage.addListener(async (message) => {
    console.log("Received message from content script:", message);

    switch (message.action) {
      case "getSelectionText":
        const result = await chrome.storage.session.get("selectionText");
        if (result?.selectionText) {
          // Send response back through the port
          port.postMessage({
            action: "getSelectionText",
            selectionText: formatSelectionText(result.selectionText, connectionInfo),
          });
        }

        break;
    }
  });

  // Handle disconnect
  port.onDisconnect.addListener(() => {
    console.log(`Connection disconnected for tab ${tab.id}`);
    activeConnections.delete(tab.id);
    console.log(`Active connections: ${activeConnections.size}`);
  });
});
