import { MessageAction, ContextMenu, type ContextMenuValue } from "@/constants";
import { logger } from "@/logger";
import {
  getSelectedText,
  hideButton,
  hideMenu,
  isValidSelection,
  positionButton,
  sendSelectionToSidePanel,
} from "./selection-popup-helpers";
import { setupSpeechPrompt } from "./selection-popup-speech";
import { createAskButton, createSelectionMenu, positionMenu } from "./ui/ask";
import { showToast } from "./ui/toast";

const SELECTION_DEBOUNCE_MS = 50;
const MENU_HIDE_DELAY_MS = 3000;
const MENU_ANIMATION_DELAY_MS = 200;
const SCROLL_HIDE_THRESHOLD = 150;
const BUTTON_AUTO_HIDE_MS = 3000;

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === MessageAction.SHOW_TOAST) {
    showToast(message.message, message.type || "error", message.duration || 5000);
  }
});

async function init() {
  if (!chrome.runtime?.id) {
    logger.error("Extension context invalidated at init. Skipping initialization.");
    return;
  }

  if (!document.body) {
    logger.warn("Document body not available yet, skipping init");
    return;
  }

  try {
    const { selectionButtonEnabled } = await chrome.storage.local.get("selectionButtonEnabled");
    if (selectionButtonEnabled === false) {
      logger.debug("Selection button disabled in settings. Skipping initialization.");
      return;
    }
  } catch (error) {
    logger.error("Error reading selection button setting:", error);
  }

  const askButton = createAskButton();
  document.body.appendChild(askButton);

  let selectionMenu: HTMLDivElement | null = null;
  let selectionTimeout: number | null = null;
  let menuTimeout: number | null = null;
  let autoHideTimeout: number | null = null;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let savedSelectedText = "";
  let buttonScrollY = 0;
  let isHoveringButtonOrMenu = false;
  let isMenuOpen = false;
  let resetMenuState = () => {};

  const clearSelectionTimeout = () => {
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
      selectionTimeout = null;
    }
  };

  const clearSavedText = () => {
    savedSelectedText = "";
  };

  const clearMenuState = () => {
    clearSavedText();
    resetMenuState();
  };

  const menuHasDraft = () => {
    if (!selectionMenu?.shadowRoot) {
      return false;
    }

    const customInput = selectionMenu.shadowRoot.querySelector(".custom-input") as HTMLInputElement | null;
    const speechTextarea = selectionMenu.shadowRoot.querySelector(".speech-textarea") as HTMLTextAreaElement | null;

    return Boolean(customInput?.value.trim().length || speechTextarea?.value.trim().length);
  };

  const clearAutoHideTimeout = () => {
    if (autoHideTimeout) {
      clearTimeout(autoHideTimeout);
      autoHideTimeout = null;
    }
  };

  const startAutoHideTimeout = () => {
    clearAutoHideTimeout();
    autoHideTimeout = window.setTimeout(() => {
      if (!isHoveringButtonOrMenu && !isMenuOpen && !menuHasDraft()) {
        hideButton(askButton, selectionMenu, clearMenuState, MENU_ANIMATION_DELAY_MS);
      }
    }, BUTTON_AUTO_HIDE_MS);
  };

  const isClickOnButtonOrMenu = (target: EventTarget | null) => {
    if (!target) {
      return false;
    }

    if (target === askButton || askButton.contains(target as Node)) {
      return true;
    }

    return Boolean(selectionMenu && (target === selectionMenu || selectionMenu.contains(target as Node)));
  };

  const submitSelection = async (
    text: string,
    formatType: ContextMenuValue = ContextMenu.AskMyAi,
    customPrompt?: string,
  ) => {
    isMenuOpen = false;
    await sendSelectionToSidePanel(text, formatType, customPrompt);
    hideButton(askButton, selectionMenu, clearMenuState, MENU_ANIMATION_DELAY_MS);
    clearAutoHideTimeout();
  };

  const handleSelectionChange = (positionX?: number, positionY?: number) => {
    clearSelectionTimeout();
    clearAutoHideTimeout();

    selectionTimeout = window.setTimeout(() => {
      const selection = window.getSelection();

      if (isValidSelection(selection)) {
        if (positionX !== undefined && positionY !== undefined) {
          positionButton(askButton, positionX, positionY);
        } else {
          const range = selection!.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          positionButton(askButton, window.scrollX + rect.right, window.scrollY + rect.bottom);
        }

        buttonScrollY = window.scrollY;
        isMenuOpen = false;
        startAutoHideTimeout();
      } else {
        hideButton(askButton, selectionMenu, clearMenuState, MENU_ANIMATION_DELAY_MS);
      }
    }, SELECTION_DEBOUNCE_MS);
  };

  const initializeMenu = () => {
    if (selectionMenu) {
      return;
    }

    selectionMenu = createSelectionMenu();
    document.body.appendChild(selectionMenu);
    setupMenuEventListeners(selectionMenu);
  };

  const setupMenuEventListeners = (menu: HTMLDivElement) => {
    menu.addEventListener("mouseenter", () => {
      isHoveringButtonOrMenu = true;
      clearAutoHideTimeout();
      if (menuTimeout) {
        clearTimeout(menuTimeout);
        menuTimeout = null;
      }
    });

    const stopPropagation = (event: Event) => event.stopPropagation();
    menu.addEventListener("click", stopPropagation);
    menu.addEventListener("mousedown", stopPropagation);

    const handleMouseLeave = () => {
      isHoveringButtonOrMenu = false;

      menuTimeout = window.setTimeout(() => {
        if (isMenuOpen && !menuHasDraft()) {
          hideMenu(menu, clearMenuState, MENU_ANIMATION_DELAY_MS);
          isMenuOpen = false;
        }
      }, MENU_HIDE_DELAY_MS);

      startAutoHideTimeout();
    };

    askButton.addEventListener("mouseleave", handleMouseLeave);
    menu.addEventListener("mouseleave", handleMouseLeave);

    const menuShadow = menu.shadowRoot!;
    const menuContainer = menuShadow.querySelector(".menu-container") as HTMLElement;
    const customInput = menuShadow.querySelector(".custom-input") as HTMLInputElement;
    const templateList = menuShadow.querySelector(".template-list") as HTMLDivElement;

    const keepMenuOpen = () => {
      isHoveringButtonOrMenu = true;
      clearAutoHideTimeout();
      if (menuTimeout) {
        clearTimeout(menuTimeout);
        menuTimeout = null;
      }
    };

    menuContainer.addEventListener("mousedown", stopPropagation);
    menuContainer.addEventListener("mouseup", stopPropagation);
    menuContainer.addEventListener("mousedown", keepMenuOpen);
    menuContainer.addEventListener("click", keepMenuOpen);

    const submitCustomPrompt = async (customPrompt: string) => {
      if (!savedSelectedText || !customPrompt) {
        return;
      }

      await submitSelection(savedSelectedText, ContextMenu.AskMyAi, customPrompt);
      customInput.value = "";
    };

    const speechPrompt = setupSpeechPrompt({
      customInput,
      menuContainer,
      menuShadow,
      onSubmitPrompt: submitCustomPrompt,
      templateList,
    });

    resetMenuState = speechPrompt.reset;

    menuShadow.querySelectorAll(".menu-item").forEach((item) => {
      item.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const action = (item as HTMLElement).getAttribute("data-action") as ContextMenuValue;
        if (!savedSelectedText) {
          logger.warn("No saved selection found when menu item clicked");
          return;
        }

        await submitSelection(savedSelectedText, action);
      });
    });

    const loadTemplates = async () => {
      try {
        const { promptTemplates } = await chrome.storage.local.get("promptTemplates");
        const templates = Array.isArray(promptTemplates) ? promptTemplates : [];

        if (templates.length === 0) {
          templateList.style.display = "none";
          return;
        }

        templateList.innerHTML = "";
        templateList.style.display = speechPrompt.isVoiceMode() ? "none" : "flex";

        templates.forEach((template) => {
          const templateItem = document.createElement("div");
          templateItem.className = "template-item";
          templateItem.textContent = template;
          templateItem.title = template;

          templateItem.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (!savedSelectedText) {
              return;
            }

            await submitSelection(savedSelectedText, ContextMenu.AskMyAi, template);
            customInput.value = "";
          });

          templateList.appendChild(templateItem);
        });
      } catch (error) {
        logger.error("Error loading templates:", error);
      }
    };

    loadTemplates();

    const stopKeyboardPropagation = (event: Event) => event.stopPropagation();

    customInput.addEventListener("keydown", async (event) => {
      stopKeyboardPropagation(event);

      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      await submitCustomPrompt(customInput.value.trim());
    });

    customInput.addEventListener("keyup", stopKeyboardPropagation);
    customInput.addEventListener("keypress", stopKeyboardPropagation);
    customInput.addEventListener("input", stopKeyboardPropagation);
    customInput.addEventListener("click", stopKeyboardPropagation);
  };

  document.addEventListener("mousemove", (event) => {
    lastMouseX = event.pageX;
    lastMouseY = event.pageY;
  });

  document.addEventListener("mouseup", (event) => {
    if (isClickOnButtonOrMenu(event.target)) {
      return;
    }

    lastMouseX = event.pageX;
    lastMouseY = event.pageY;
    handleSelectionChange(lastMouseX, lastMouseY);
  });

  const textSelectionKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];

  document.addEventListener("keyup", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey || !textSelectionKeys.includes(event.key)) {
      return;
    }

    handleSelectionChange();
  });

  document.addEventListener("keydown", (event) => {
    // Select-all updates the DOM selection after this keydown handler runs,
    // so defer the popup refresh until the next frame when the new range exists.
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      window.requestAnimationFrame(() => {
        handleSelectionChange();
      });
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "c" && askButton.style.display !== "none") {
      hideButton(askButton, selectionMenu, clearMenuState, MENU_ANIMATION_DELAY_MS);
      clearAutoHideTimeout();
      return;
    }

    if (event.key === "Escape") {
      hideButton(askButton, selectionMenu, clearMenuState, MENU_ANIMATION_DELAY_MS);
    }
  });

  document.addEventListener("mousedown", (event) => {
    if (isClickOnButtonOrMenu(event.target)) {
      return;
    }

    clearSelectionTimeout();
    clearAutoHideTimeout();

    setTimeout(() => {
      if (!isValidSelection(window.getSelection())) {
        hideButton(askButton, selectionMenu, clearMenuState, MENU_ANIMATION_DELAY_MS);
      }
    }, SELECTION_DEBOUNCE_MS + 50);
  });

  askButton.addEventListener("mouseenter", () => {
    isHoveringButtonOrMenu = true;
    clearAutoHideTimeout();

    if (menuTimeout) {
      clearTimeout(menuTimeout);
      menuTimeout = null;
    }

    initializeMenu();

    const text = getSelectedText();
    if (text) {
      savedSelectedText = text;
    }

    if (selectionMenu) {
      isMenuOpen = true;
      positionMenu(selectionMenu, askButton);
    }
  });

  askButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const textToSend = savedSelectedText || getSelectedText();
    if (!textToSend) {
      logger.warn("No valid selection found when button was clicked");
      return;
    }

    await submitSelection(textToSend);
  });

  document.addEventListener(
    "scroll",
    () => {
      if (askButton.style.display === "none") {
        return;
      }

      const scrollDelta = Math.abs(window.scrollY - buttonScrollY);
      if (scrollDelta > SCROLL_HIDE_THRESHOLD) {
        clearAutoHideTimeout();
        hideButton(askButton, selectionMenu, clearMenuState, MENU_ANIMATION_DELAY_MS);
      }
    },
    true,
  );
}

try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
} catch (error) {
  logger.error("failed to initialize:", error);
}
