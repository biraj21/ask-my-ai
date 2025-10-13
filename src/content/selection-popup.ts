import { MessageAction, SESSION_STORAGE_KEYS, ContextMenu, type ContextMenuValue } from "../constants";
import { logger } from "../logger";
import { showToast } from "./ui/toast";
import { createAskButton, createSelectionMenu, positionMenu } from "./ui/ask";

// Hide menu
function hideMenu(menu: HTMLElement, clearSavedText?: () => void) {
  menu.classList.remove("show");

  // Wait for animation to finish before hiding
  setTimeout(() => {
    menu.style.display = "none";
    if (clearSavedText) {
      clearSavedText();
    }
  }, 200);
}

// Position the button near the cursor position with smart edge detection
function positionButton(button: HTMLElement, mouseX: number, mouseY: number) {
  const offset = 5; // Distance from cursor (very close for immediate clicking)
  const edgeMargin = 20; // Minimum distance from viewport edges

  // Get viewport boundaries
  const viewportTop = window.scrollY + edgeMargin;
  const viewportBottom = window.scrollY + window.innerHeight - edgeMargin;
  const viewportLeft = window.scrollX + edgeMargin;
  const viewportRight = window.scrollX + window.innerWidth - edgeMargin;

  // Get button dimensions (approximate if not yet rendered)
  const buttonWidth = button.offsetWidth || 120;
  const buttonHeight = button.offsetHeight || 40;

  // Calculate available space in each direction
  const spaceRight = viewportRight - mouseX - offset;
  const spaceLeft = mouseX - viewportLeft - offset;
  const spaceBelow = viewportBottom - mouseY - offset;
  const spaceAbove = mouseY - viewportTop - offset;

  let top: number;
  let left: number;

  // Determine horizontal position (prefer right, but use left if needed)
  if (spaceRight >= buttonWidth) {
    // Enough space on the right
    left = mouseX + offset;
  } else if (spaceLeft >= buttonWidth) {
    // Not enough space on right, use left
    left = mouseX - buttonWidth - offset;
  } else {
    // Not enough space on either side, center horizontally or use available space
    if (spaceRight > spaceLeft) {
      left = mouseX + offset;
    } else {
      left = mouseX - buttonWidth - offset;
    }
    // Clamp to viewport
    left = Math.max(viewportLeft, Math.min(left, viewportRight - buttonWidth));
  }

  // Determine vertical position (prefer below, but use above if needed)
  if (spaceBelow >= buttonHeight) {
    // Enough space below
    top = mouseY + offset;
  } else if (spaceAbove >= buttonHeight) {
    // Not enough space below, use above
    top = mouseY - buttonHeight - offset;
  } else {
    // Not enough space above or below, use available space
    if (spaceBelow > spaceAbove) {
      top = mouseY + offset;
    } else {
      top = mouseY - buttonHeight - offset;
    }
    // Clamp to viewport
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
function hideButton(button: HTMLElement, menu?: HTMLElement, clearSavedText?: () => void) {
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

  // Don't show button in input fields or contenteditable elements
  const anchorNode = selection.anchorNode;
  if (!anchorNode) return false;

  const parentElement = anchorNode.parentElement;
  if (!parentElement) return false;

  const tagName = parentElement.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea") {
    return false;
  }

  if (parentElement.isContentEditable) {
    return false;
  }

  return true;
}

// Send selected text to service worker to open side panel
async function sendSelectionToSidePanel(text: string, formatType: ContextMenuValue = ContextMenu.AskMyAi) {
  try {
    // Check if extension context is valid
    if (!chrome.runtime?.id) {
      logger.error("Extension context invalidated. Please refresh the page.");
      showToast("Extension was updated. Please refresh this page.", "info", 7000);
      return;
    }

    // Send message to service worker
    const message = {
      action: MessageAction.OPEN_SIDE_PANEL_WITH_TEXT,
      text: text,
      formatType: formatType,
      url: window.location.href,
      title: document.title,
    };

    await chrome.runtime.sendMessage(message);
  } catch (error) {
    const err = error as Error;
    if (err.message?.includes("Extension context invalidated")) {
      logger.error("Extension context invalidated. Please refresh the page.");
      showToast("Extension was updated. Please refresh this page.", "info", 7000);
    } else if (err.message?.includes("Could not establish connection")) {
      logger.error("Could not establish connection with extension");
      showToast("Failed to connect. Try refreshing the page.", "error", 5000);
    } else {
      logger.error("Error sending selection to side panel:", error);
      showToast("Something went wrong. Please try again.", "error", 4000);
    }
  }
}

// Send selected text with custom prompt to service worker
async function sendSelectionToSidePanelWithCustomPrompt(text: string, customPrompt: string) {
  try {
    // Check if extension context is valid
    if (!chrome.runtime?.id) {
      logger.error("Extension context invalidated. Please refresh the page.");
      showToast("Extension was updated. Please refresh this page.", "info", 7000);
      return;
    }

    // Send message to service worker with custom prompt
    const message = {
      action: MessageAction.OPEN_SIDE_PANEL_WITH_TEXT,
      text: text,
      formatType: ContextMenu.AskMyAi,
      customPrompt: customPrompt,
      url: window.location.href,
      title: document.title,
    };

    await chrome.runtime.sendMessage(message);
  } catch (error) {
    const err = error as Error;
    if (err.message?.includes("Extension context invalidated")) {
      logger.error("Extension context invalidated. Please refresh the page.");
      showToast("Extension was updated. Please refresh this page.", "info", 7000);
    } else if (err.message?.includes("Could not establish connection")) {
      logger.error("Could not establish connection with extension");
      showToast("Failed to connect. Try refreshing the page.", "error", 5000);
    } else {
      logger.error("Error sending selection to side panel:", error);
      showToast("Something went wrong. Please try again.", "error", 4000);
    }
  }
}

// Listen for messages from service worker (e.g., to show toasts)
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.action === MessageAction.SHOW_TOAST) {
    showToast(message.message, message.type || "error", message.duration || 5000);
  }
});

// Main initialization
function init() {
  // Check if extension context is valid
  if (!chrome.runtime?.id) {
    logger.error("Extension context invalidated at init. Skipping initialization.");
    return;
  }

  // Wait for body to be available
  if (!document.body) {
    logger.warn("Document body not available yet, skipping init");
    return;
  }

  logger.debug(`selection popup initializing on`, window.location.href);

  // Create and append the button and menu
  const askButton = createAskButton();
  const selectionMenu = createSelectionMenu();
  document.body.appendChild(askButton);
  document.body.appendChild(selectionMenu);

  let selectionTimeout: number | null = null;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let menuTimeout: number | null = null;
  let savedSelectedText = ""; // Store selected text when menu appears

  // Track mouse position
  document.addEventListener("mousemove", (e) => {
    lastMouseX = e.pageX;
    lastMouseY = e.pageY;
  });

  // Handle text selection
  document.addEventListener("mouseup", (e) => {
    // Don't reposition if clicking on the button or menu
    if (
      e.target === askButton ||
      askButton.contains(e.target as Node) ||
      e.target === selectionMenu ||
      selectionMenu.contains(e.target as Node)
    ) {
      return;
    }

    // Update position on mouseup
    lastMouseX = e.pageX;
    lastMouseY = e.pageY;

    // Clear any pending timeout
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }

    // Small delay to ensure selection is complete
    selectionTimeout = window.setTimeout(() => {
      const selection = window.getSelection();

      if (isValidSelection(selection)) {
        positionButton(askButton, lastMouseX, lastMouseY);
      } else {
        hideButton(askButton, selectionMenu, () => (savedSelectedText = ""));
      }
    }, 10);
  });

  // Handle keyboard selection (e.g., Shift+Arrow keys)
  // Only reposition for actual text selection keys, not keyboard shortcuts
  const textSelectionKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];

  document.addEventListener("keyup", (e) => {
    // Ignore if Ctrl, Alt, or Meta (Cmd) are pressed (indicates a shortcut, not selection)
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    // Only handle actual text selection keys
    if (!textSelectionKeys.includes(e.key)) {
      return;
    }

    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }

    selectionTimeout = window.setTimeout(() => {
      const selection = window.getSelection();

      if (isValidSelection(selection)) {
        // For keyboard selection, position near the end of selection
        const range = selection!.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        positionButton(askButton, window.scrollX + rect.right, window.scrollY + rect.bottom);
      } else {
        hideButton(askButton, selectionMenu, () => (savedSelectedText = ""));
      }
    }, 10);
  });

  // Hide button when clicking elsewhere
  document.addEventListener("mousedown", (e) => {
    // Don't hide if clicking on button or menu
    if (
      e.target === askButton ||
      askButton.contains(e.target as Node) ||
      e.target === selectionMenu ||
      selectionMenu.contains(e.target as Node)
    ) {
      return;
    }

    // Small delay to allow button click to register
    setTimeout(() => {
      const selection = window.getSelection();
      if (!isValidSelection(selection)) {
        hideButton(askButton, selectionMenu, () => (savedSelectedText = ""));
      }
    }, 100);
  });

  // Show menu on button hover
  askButton.addEventListener("mouseenter", () => {
    if (menuTimeout) clearTimeout(menuTimeout);

    // Capture selected text when menu appears
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      savedSelectedText = selection.toString().trim();
    }

    positionMenu(selectionMenu, askButton);
  });

  // Keep menu open when hovering over it
  selectionMenu.addEventListener("mouseenter", () => {
    if (menuTimeout) clearTimeout(menuTimeout);
  });

  // Prevent menu from being hidden when clicking inside it
  selectionMenu.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  selectionMenu.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  // Hide menu when mouse leaves both button and menu
  const handleMouseLeave = () => {
    menuTimeout = window.setTimeout(() => {
      hideMenu(selectionMenu, () => (savedSelectedText = ""));
    }, 200);
  };

  askButton.addEventListener("mouseleave", handleMouseLeave);
  selectionMenu.addEventListener("mouseleave", handleMouseLeave);

  // Handle menu item clicks
  const menuShadow = selectionMenu.shadowRoot!;
  const menuContainer = menuShadow.querySelector(".menu-container") as HTMLElement;

  // Prevent all events from bubbling out of menu container
  menuContainer.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  menuContainer.addEventListener("mouseup", (e) => {
    e.stopPropagation();
  });

  menuShadow.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const action = (item as HTMLElement).getAttribute("data-action") as ContextMenuValue;

      if (savedSelectedText) {
        await sendSelectionToSidePanel(savedSelectedText, action);
        hideButton(askButton, selectionMenu);
        savedSelectedText = ""; // Clear saved text
      } else {
        logger.warn("No saved selection found when menu item clicked");
      }
    });
  });

  // Handle custom input
  const customInput = menuShadow.querySelector(".custom-input") as HTMLInputElement;
  customInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();

      const customPrompt = customInput.value.trim();

      if (savedSelectedText && customPrompt) {
        // Send with custom prompt in proper format
        await sendSelectionToSidePanelWithCustomPrompt(savedSelectedText, customPrompt);
        hideButton(askButton, selectionMenu);
        customInput.value = ""; // Clear input
        savedSelectedText = ""; // Clear saved text
      }
    }
  });

  // Prevent input from losing focus when clicking
  customInput.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Handle button click (fallback if user clicks before hover)
  askButton.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Use saved text if available, otherwise get fresh selection
    const textToSend = savedSelectedText || window.getSelection()?.toString().trim() || "";

    if (textToSend) {
      await sendSelectionToSidePanel(textToSend);
      hideButton(askButton, selectionMenu);
      savedSelectedText = ""; // Clear saved text
    } else {
      logger.warn("No valid selection found when button was clicked");
    }
  });

  // Hide button when scrolling
  let scrollTimeout: number | null = null;
  document.addEventListener(
    "scroll",
    () => {
      if (askButton.style.display === "flex") {
        // Hide temporarily during scroll
        askButton.style.opacity = "0.3";

        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }

        scrollTimeout = window.setTimeout(() => {
          const selection = window.getSelection();
          if (isValidSelection(selection)) {
            positionButton(askButton, lastMouseX, lastMouseY);
            askButton.style.opacity = "1";
          } else {
            hideButton(askButton, selectionMenu, () => (savedSelectedText = ""));
            askButton.style.opacity = "1";
          }
        }, 150);
      }
    },
    true
  );

  logger.debug(`selection popup fully initialized on`, window.location.href);
}

// Run initialization with multiple attempts
try {
  if (document.readyState === "loading") {
    logger.debug(`waiting for DOMContentLoaded...`);
    document.addEventListener("DOMContentLoaded", init);
  } else {
    logger.debug(`DOM already loaded, initializing now...`);
    init();
  }
} catch (error) {
  logger.error(`failed to initialize:`, error);
}
