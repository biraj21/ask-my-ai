import { COMMAND_SHORTCUTS } from "./constants";
import { isItMac } from "./utils";

const isMac = isItMac();

document.getElementById("open-sidebar")?.addEventListener("click", async () => {
  try {
    const currWindow = await chrome.windows.getCurrent();
    if (currWindow.id) {
      await chrome.sidePanel.open({ windowId: currWindow.id });
    }
  } catch (error) {
    console.error("Error opening side panel:", error);
  }
});

document.getElementById("open-shortcuts-page")?.addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

function formatShortcut(shortcut: string): string[] {
  // Shortcut comes as "⇧⌘Y" or "Ctrl+Shift+E" depending on OS
  const modifiers: { order: number; display: string }[] = [];
  let regularKey = "";

  // Check if it has + separators (Windows/Linux format)
  if (shortcut.includes("+")) {
    const parts = shortcut.split("+").map((p) => p.trim());
    for (const part of parts) {
      if (part === "Ctrl" || part === "Control") {
        modifiers.push({ order: 0, display: "Ctrl" });
      } else if (part === "Command" || part === "MacCtrl") {
        modifiers.push({ order: 0, display: "⌘ Command" });
      } else if (part === "Shift") {
        modifiers.push({ order: 1, display: "Shift" });
      } else if (part === "Alt") {
        modifiers.push({ order: 2, display: "Alt" });
      } else {
        regularKey = part;
      }
    }
  } else {
    // Mac format: "⇧⌘Y" - symbols concatenated together
    for (let i = 0; i < shortcut.length; i++) {
      const char = shortcut[i];
      if (char === "⌘") {
        modifiers.push({ order: 0, display: "⌘ Command" });
      } else if (char === "⇧") {
        modifiers.push({ order: 1, display: "⇧ Shift" });
      } else if (char === "⌥") {
        modifiers.push({ order: 2, display: "⌥ Option" });
      } else if (char === "⌃") {
        modifiers.push({ order: 0, display: "⌃ Control" });
      } else {
        // Regular key - push the rest of the string
        regularKey = shortcut.slice(i);
        break;
      }
    }
  }

  // Sort modifiers by order
  modifiers.sort((a, b) => a.order - b.order);

  // Build result array
  const result = modifiers.map((m) => m.display);
  if (regularKey) {
    result.push(regularKey);
  }

  return result;
}

function updateShortcutDisplay(shortcut: string, containerId: string) {
  const container = document.querySelector(`#${containerId} .shortcut-key`);
  if (!container) return;

  const parts = formatShortcut(shortcut);

  // Update existing kbd elements
  const kbdElements = container.querySelectorAll("kbd");
  parts.forEach((part, index) => {
    if (kbdElements[index]) {
      kbdElements[index].textContent = part;
    }
  });
}

async function checkAndDisplayShortcutStatus() {
  const commands = await chrome.commands.getAll();

  const openSidePanelCommand = commands.find((cmd) => cmd.name === COMMAND_SHORTCUTS.OPEN_SIDE_PANEL);

  const shortcutInfoElement = document.getElementById("shortcut-info");
  const shortcutWarningElement = document.getElementById("shortcut-warning");

  if (!openSidePanelCommand?.shortcut) {
    // Shortcut is missing, show warning
    if (shortcutInfoElement) {
      shortcutInfoElement.style.display = "none";
    }
    if (shortcutWarningElement) {
      shortcutWarningElement.style.display = "block";
    }

    // Show the suggested shortcut in the warning
    const suggestedShortcut = isMac ? "⌘+Shift+E" : "Ctrl+Shift+E";
    const warningDesc = shortcutWarningElement?.querySelector(".warning-description");
    if (warningDesc) {
      warningDesc.innerHTML = `Another extension may be using <strong><kbd>${suggestedShortcut.replace(
        /\+/g,
        "</kbd> + <kbd>"
      )}</kbd></strong>. You can set it manually:`;
    }
  } else {
    // Shortcut is set, show normal info with actual shortcut
    if (shortcutInfoElement) {
      shortcutInfoElement.style.display = "block";
      updateShortcutDisplay(openSidePanelCommand.shortcut, "shortcut-info");
    }
    if (shortcutWarningElement) {
      shortcutWarningElement.style.display = "none";
    }
  }
}

// Check shortcut status on load
document.addEventListener("DOMContentLoaded", checkAndDisplayShortcutStatus);
