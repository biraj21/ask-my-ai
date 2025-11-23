import { AI_WEBSITES, COMMAND_SHORTCUTS } from "./constants";
import { ExtStorage } from "./storage";
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
  const container = document.querySelector(`#${containerId} .left-panel__shortcut-keys`);
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
    const warningDesc = shortcutWarningElement?.querySelector(".left-panel__warning-description");
    if (warningDesc) {
      warningDesc.innerHTML = `Another extension may be using
<div id="warning-shortcut">
<kbd>${suggestedShortcut.replace(/\+/g, "</kbd> + <kbd>")}</kbd>
</div>`;
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

async function initSettings() {
  // Floating selection button toggle
  const selectionToggle = document.getElementById("toggle-selection-button") as HTMLInputElement | null;
  if (selectionToggle) {
    try {
      const enabled = await ExtStorage.local.getSelectionButtonEnabled();
      selectionToggle.checked = enabled;

      selectionToggle.addEventListener("change", async () => {
        await ExtStorage.local.setSelectionButtonEnabled(selectionToggle.checked);
      });
    } catch (error) {
      console.error("Error initializing selection button toggle:", error);
    }
  }

  // AI visibility settings
  const aiListContainer = document.getElementById("ai-list");
  if (!aiListContainer) {
    return;
  }

  let enabledAIs = await ExtStorage.local.getEnabledAIs();
  const allAiKeys = Object.keys(AI_WEBSITES) as (keyof typeof AI_WEBSITES)[];

  // Default: all enabled
  if (!enabledAIs || enabledAIs.length === 0) {
    enabledAIs = allAiKeys as any;
  }

  const render = () => {
    aiListContainer.innerHTML = "";

    allAiKeys.forEach((key) => {
      const item = document.createElement("label");
      item.className = "ai-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = enabledAIs!.includes(key as any);

      const span = document.createElement("span");
      span.textContent = AI_WEBSITES[key].label;

      item.appendChild(checkbox);
      item.appendChild(span);

      checkbox.addEventListener("change", async () => {
        const currentlyEnabled = new Set(enabledAIs);

        if (checkbox.checked) {
          currentlyEnabled.add(key as any);
        } else {
          // Prevent disabling all providers – keep at least one
          if (currentlyEnabled.size <= 1) {
            checkbox.checked = true;
            return;
          }
          currentlyEnabled.delete(key as any);
        }

        enabledAIs = Array.from(currentlyEnabled) as any;
        await ExtStorage.local.setEnabledAIs(enabledAIs as any);
      });

      aiListContainer.appendChild(item);
    });
  };

  render();
}

// Prompt templates functionality
async function initPromptTemplates() {
  const promptInput = document.getElementById("new-prompt-input") as HTMLInputElement;
  const addButton = document.getElementById("add-prompt-btn") as HTMLButtonElement;
  const promptList = document.getElementById("prompt-list") as HTMLElement;

  if (!promptInput || !addButton || !promptList) {
    return;
  }

  const renderPrompts = async () => {
    const templates = await ExtStorage.local.getPromptTemplates();
    promptList.innerHTML = "";

    templates.forEach((template, index) => {
      const item = document.createElement("div");
      item.className = "prompt-item";

      const textSpan = document.createElement("span");
      textSpan.className = "prompt-item-text";
      textSpan.textContent = template;
      textSpan.title = template;

      const deleteBtn = document.createElement("span");
      deleteBtn.className = "prompt-delete-btn";
      deleteBtn.textContent = "×";
      deleteBtn.title = "Remove template";

      textSpan.addEventListener("click", () => {
        // Copy template to input field
        promptInput.value = template;
        promptInput.focus();
      });

      deleteBtn.addEventListener("click", async () => {
        await ExtStorage.local.removePromptTemplate(index);
        renderPrompts();
      });

      item.appendChild(textSpan);
      item.appendChild(deleteBtn);
      promptList.appendChild(item);
    });
  };

  const addTemplate = async () => {
    const template = promptInput.value.trim();
    if (template) {
      await ExtStorage.local.addPromptTemplate(template);
      promptInput.value = "";
      renderPrompts();
    }
  };

  addButton.addEventListener("click", addTemplate);
  promptInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addTemplate();
    }
  });

  renderPrompts();
}

// Initialize popup UI on load
document.addEventListener("DOMContentLoaded", () => {
  checkAndDisplayShortcutStatus();
  initSettings();
  initPromptTemplates();
});
