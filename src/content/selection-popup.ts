import { MessageAction, SESSION_STORAGE_KEYS, ContextMenu, type ContextMenuValue } from "../constants";
import { logger } from "../logger";
import { showToast } from "./ui/toast";
import { createAskButton, createSelectionMenu, positionMenu } from "./ui/ask";

const SELECTION_DEBOUNCE_MS = 50;
const MENU_HIDE_DELAY_MS = 200;
const MENU_ANIMATION_DELAY_MS = 200;

// Hide menu
function hideMenu(menu: HTMLElement, clearSavedText?: () => void) {
  menu.classList.remove("show");
  setTimeout(() => {
    menu.style.display = "none";
    clearSavedText?.();
  }, MENU_ANIMATION_DELAY_MS);
}

// Position the button near the cursor position with smart edge detection
function positionButton(button: HTMLElement, mouseX: number, mouseY: number) {
  const offset = 5;
  const edgeMargin = 20;

  const viewportTop = window.scrollY + edgeMargin;
  const viewportBottom = window.scrollY + window.innerHeight - edgeMargin;
  const viewportLeft = window.scrollX + edgeMargin;
  const viewportRight = window.scrollX + window.innerWidth - edgeMargin;

  const buttonWidth = button.offsetWidth || 120;
  const buttonHeight = button.offsetHeight || 40;

  // Calculate available space
  const spaceRight = viewportRight - mouseX - offset;
  const spaceLeft = mouseX - viewportLeft - offset;
  const spaceBelow = viewportBottom - mouseY - offset;
  const spaceAbove = mouseY - viewportTop - offset;

  // Determine horizontal position (prefer right, fallback to left)
  let left: number;
  if (spaceRight >= buttonWidth) {
    left = mouseX + offset;
  } else if (spaceLeft >= buttonWidth) {
    left = mouseX - buttonWidth - offset;
  } else {
    left = spaceRight > spaceLeft ? mouseX + offset : mouseX - buttonWidth - offset;
    left = Math.max(viewportLeft, Math.min(left, viewportRight - buttonWidth));
  }

  // Determine vertical position (prefer below, fallback to above)
  let top: number;
  if (spaceBelow >= buttonHeight) {
    top = mouseY + offset;
  } else if (spaceAbove >= buttonHeight) {
    top = mouseY - buttonHeight - offset;
  } else {
    top = spaceBelow > spaceAbove ? mouseY + offset : mouseY - buttonHeight - offset;
    top = Math.max(viewportTop, Math.min(top, viewportBottom - buttonHeight));
  }

  // Final clamping to ensure button stays within viewport
  top = Math.max(viewportTop, Math.min(top, viewportBottom - buttonHeight));
  left = Math.max(viewportLeft, Math.min(left, viewportRight - buttonWidth));

  button.style.top = `${top}px`;
  button.style.left = `${left}px`;
  button.style.display = "block";
}

// Hide the button (Shadow DOM host element)
function hideButton(button: HTMLElement, menu?: HTMLElement | null, clearSavedText?: () => void) {
  button.style.display = "none";
  if (menu) {
    hideMenu(menu, clearSavedText);
  }
}

// Check if the selection is valid (not empty, not in an input field)
function isValidSelection(selection: Selection | null): boolean {
  if (sessionStorage.getItem(SESSION_STORAGE_KEYS.IN_SIDE_PANEL)) {
    logger.debug("IN_SIDE_PANEL is true, skipping selection popup");
    return false;
  }

  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    return false;
  }

  const anchorNode = selection.anchorNode;
  if (!anchorNode?.parentElement) {
    return false;
  }

  const parent = anchorNode.parentElement;
  const tagName = parent.tagName.toLowerCase();

  return tagName !== "input" && tagName !== "textarea" && !parent.isContentEditable;
}

// Get selected text, trimmed
function getSelectedText(): string {
  return window.getSelection()?.toString().trim() || "";
}

// Handle extension context errors
function handleExtensionError(error: unknown): void {
  const err = error as Error;
  const message = err.message || "";

  if (message.includes("Extension context invalidated")) {
    logger.error("Extension context invalidated. Please refresh the page.");
    showToast("Extension was updated. Please refresh this page.", "info", 7000);
  } else if (message.includes("Could not establish connection")) {
    logger.error("Could not establish connection with extension");
    showToast("Failed to connect. Try refreshing the page.", "error", 5000);
  } else {
    logger.error("Error sending selection to side panel:", error);
    showToast("Something went wrong. Please try again.", "error", 4000);
  }
}

// Send selected text to service worker to open side panel
async function sendSelectionToSidePanel(
  text: string,
  formatType: ContextMenuValue = ContextMenu.AskMyAi,
  customPrompt?: string
): Promise<void> {
  if (!chrome.runtime?.id) {
    logger.error("Extension context invalidated. Please refresh the page.");
    showToast("Extension was updated. Please refresh this page.", "info", 7000);
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      action: MessageAction.OPEN_SIDE_PANEL_WITH_TEXT,
      text,
      formatType: customPrompt ? ContextMenu.AskMyAi : formatType,
      customPrompt,
      url: window.location.href,
      title: document.title,
    });
  } catch (error) {
    handleExtensionError(error);
  }
}

// Listen for messages from service worker (e.g., to show toasts)
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === MessageAction.SHOW_TOAST) {
    showToast(message.message, message.type || "error", message.duration || 5000);
  }
});

// Main initialization
async function init() {
  if (!chrome.runtime?.id) {
    logger.error("Extension context invalidated at init. Skipping initialization.");
    return;
  }

  if (!document.body) {
    logger.warn("Document body not available yet, skipping init");
    return;
  }

  // Check global setting for floating selection button
  try {
    const { selectionButtonEnabled } = await chrome.storage.local.get("selectionButtonEnabled");
    if (selectionButtonEnabled === false) {
      logger.debug("Selection button disabled in settings. Skipping initialization.");
      return;
    }
  } catch (error) {
    logger.error("Error reading selection button setting:", error);
    // In case of error, fall through and still show the button
  }

  // Create and append the button (menu will be lazy-loaded on first hover)
  const askButton = createAskButton();
  document.body.appendChild(askButton);

  // Lazy-loaded menu (created only when needed)
  let selectionMenu: HTMLDivElement | null = null;
  let selectionTimeout: number | null = null;
  let menuTimeout: number | null = null;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let savedSelectedText = "";

  // Helper: Clear selection timeout
  const clearSelectionTimeout = () => {
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
      selectionTimeout = null;
    }
  };

  // Helper: Check if click is on button or menu
  const isClickOnButtonOrMenu = (target: EventTarget | null): boolean => {
    if (!target) {
      return false;
    }
    if (target === askButton || askButton.contains(target as Node)) {
      return true;
    }
    if (selectionMenu && (target === selectionMenu || selectionMenu.contains(target as Node))) {
      return true;
    }
    return false;
  };

  // Helper: Clear saved text
  const clearSavedText = () => {
    savedSelectedText = "";
  };

  // Helper: Handle selection change
  const handleSelectionChange = (positionX?: number, positionY?: number) => {
    clearSelectionTimeout();

    selectionTimeout = window.setTimeout(() => {
      const selection = window.getSelection();

      if (isValidSelection(selection)) {
        if (positionX !== undefined && positionY !== undefined) {
          positionButton(askButton, positionX, positionY);
        } else {
          // For keyboard selection, position near the end of selection
          const range = selection!.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          positionButton(askButton, window.scrollX + rect.right, window.scrollY + rect.bottom);
        }
      } else {
        hideButton(askButton, selectionMenu, clearSavedText);
      }
    }, SELECTION_DEBOUNCE_MS);
  };

  // Track mouse position
  document.addEventListener("mousemove", (e) => {
    lastMouseX = e.pageX;
    lastMouseY = e.pageY;
  });

  // Handle text selection (mouse)
  document.addEventListener("mouseup", (e) => {
    if (isClickOnButtonOrMenu(e.target)) {
      return;
    }

    lastMouseX = e.pageX;
    lastMouseY = e.pageY;
    handleSelectionChange(lastMouseX, lastMouseY);
  });

  // Handle keyboard selection
  const textSelectionKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];

  document.addEventListener("keyup", (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }
    if (!textSelectionKeys.includes(e.key)) {
      return;
    }

    handleSelectionChange();
  });

  // Handle Escape key to close popup and menu
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideButton(askButton, selectionMenu, clearSavedText);
    }
  });

  // Hide button when clicking elsewhere
  document.addEventListener("mousedown", (e) => {
    if (isClickOnButtonOrMenu(e.target)) {
      return;
    }

    clearSelectionTimeout();

    setTimeout(() => {
      const selection = window.getSelection();
      if (!isValidSelection(selection)) {
        hideButton(askButton, selectionMenu, clearSavedText);
      }
    }, SELECTION_DEBOUNCE_MS + 50);
  });

  // Initialize menu lazily on first hover
  const initializeMenu = (): void => {
    if (selectionMenu) {
      return;
    }

    selectionMenu = createSelectionMenu();
    document.body.appendChild(selectionMenu);
    setupMenuEventListeners();
  };

  // Show menu on button hover
  askButton.addEventListener("mouseenter", () => {
    if (menuTimeout) {
      clearTimeout(menuTimeout);
    }

    initializeMenu();

    const text = getSelectedText();
    if (text) {
      savedSelectedText = text;
    }

    if (selectionMenu) {
      positionMenu(selectionMenu, askButton);
    }
  });

  // Setup menu event listeners (called after menu is created)
  function setupMenuEventListeners() {
    if (!selectionMenu) {
      return;
    }

    // Keep menu open when hovering over it
    selectionMenu.addEventListener("mouseenter", () => {
      if (menuTimeout) {
        clearTimeout(menuTimeout);
      }
    });

    // Prevent menu events from bubbling
    const stopPropagation = (e: Event) => e.stopPropagation();
    selectionMenu.addEventListener("click", stopPropagation);
    selectionMenu.addEventListener("mousedown", stopPropagation);

    // Hide menu when mouse leaves both button and menu
    const handleMouseLeave = () => {
      menuTimeout = window.setTimeout(() => {
        if (selectionMenu) {
          hideMenu(selectionMenu, clearSavedText);
        }
      }, MENU_HIDE_DELAY_MS);
    };

    askButton.addEventListener("mouseleave", handleMouseLeave);
    selectionMenu.addEventListener("mouseleave", handleMouseLeave);

    // Handle menu item clicks
    const menuShadow = selectionMenu.shadowRoot!;
    const menuContainer = menuShadow.querySelector(".menu-container") as HTMLElement;

    // Prevent events from bubbling out of menu container
    menuContainer.addEventListener("mousedown", stopPropagation);
    menuContainer.addEventListener("mouseup", stopPropagation);

    menuShadow.querySelectorAll(".menu-item").forEach((item) => {
      item.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const action = (item as HTMLElement).getAttribute("data-action") as ContextMenuValue;

        if (savedSelectedText) {
          await sendSelectionToSidePanel(savedSelectedText, action);
          hideButton(askButton, selectionMenu);
          clearSavedText();
        } else {
          logger.warn("No saved selection found when menu item clicked");
        }
      });
    });

    // Handle custom input
    const customInput = menuShadow.querySelector(".custom-input") as HTMLInputElement;

    // Stop all keyboard events from bubbling
    const stopKeyboardPropagation = (e: Event) => e.stopPropagation();
    customInput.addEventListener("keydown", async (e) => {
      stopKeyboardPropagation(e);

      if (e.key === "Enter") {
        e.preventDefault();

        const customPrompt = customInput.value.trim();

        if (savedSelectedText && customPrompt) {
          await sendSelectionToSidePanel(savedSelectedText, ContextMenu.AskMyAi, customPrompt);
          hideButton(askButton, selectionMenu);
          customInput.value = "";
          clearSavedText();
        }
      }
    });

    customInput.addEventListener("keyup", stopKeyboardPropagation);
    customInput.addEventListener("keypress", stopKeyboardPropagation);
    customInput.addEventListener("input", stopKeyboardPropagation);
    customInput.addEventListener("click", stopKeyboardPropagation);
  }

  // Handle button click (fallback if user clicks before hover)
  askButton.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const textToSend = savedSelectedText || getSelectedText();

    if (textToSend) {
      await sendSelectionToSidePanel(textToSend);
      hideButton(askButton, selectionMenu);
      clearSavedText();
    } else {
      logger.warn("No valid selection found when button was clicked");
    }
  });

  // Hide button when scrolling - gentler behavior:
  // if the button is visible and user scrolls, simply hide it.
  document.addEventListener(
    "scroll",
    () => {
      if (askButton.style.display !== "none") {
        hideButton(askButton, selectionMenu, clearSavedText);
      }
    },
    true
  );
}

// Run initialization
try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
} catch (error) {
  logger.error(`failed to initialize:`, error);
}
