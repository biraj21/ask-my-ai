import { ContextMenu, MessageAction, SESSION_STORAGE_KEYS, type ContextMenuValue } from "@/constants";
import { logger } from "@/logger";
import { showToast } from "./ui/toast";

const MIN_WORD_COUNT = 2;

function isValidWordCount(text: string): boolean {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return words.length >= MIN_WORD_COUNT;
}

export function hideMenu(menu: HTMLElement, clearMenuState?: () => void, animationDelayMs = 200) {
  menu.classList.remove("show");
  setTimeout(() => {
    menu.style.display = "none";
    clearMenuState?.();
  }, animationDelayMs);
}

export function hideButton(
  button: HTMLElement,
  menu?: HTMLElement | null,
  clearMenuState?: () => void,
  animationDelayMs = 200,
) {
  button.style.display = "none";
  if (menu) {
    hideMenu(menu, clearMenuState, animationDelayMs);
  }
}

export function positionButton(button: HTMLElement, mouseX: number, mouseY: number) {
  const offset = 20;
  const edgeMargin = 20;

  const viewportTop = window.scrollY + edgeMargin;
  const viewportBottom = window.scrollY + window.innerHeight - edgeMargin;
  const viewportLeft = window.scrollX + edgeMargin;
  const viewportRight = window.scrollX + window.innerWidth - edgeMargin;

  const buttonWidth = button.offsetWidth || 120;
  const buttonHeight = button.offsetHeight || 40;

  const spaceRight = viewportRight - mouseX - offset;
  const spaceLeft = mouseX - viewportLeft - offset;
  const spaceBelow = viewportBottom - mouseY - offset;
  const spaceAbove = mouseY - viewportTop - offset;

  let left: number;
  if (spaceRight >= buttonWidth) {
    left = mouseX + offset;
  } else if (spaceLeft >= buttonWidth) {
    left = mouseX - buttonWidth - offset;
  } else {
    left = spaceRight > spaceLeft ? mouseX + offset : mouseX - buttonWidth - offset;
    left = Math.max(viewportLeft, Math.min(left, viewportRight - buttonWidth));
  }

  let top: number;
  if (spaceBelow >= buttonHeight) {
    top = mouseY + offset;
  } else if (spaceAbove >= buttonHeight) {
    top = mouseY - buttonHeight - offset;
  } else {
    top = spaceBelow > spaceAbove ? mouseY + offset : mouseY - buttonHeight - offset;
    top = Math.max(viewportTop, Math.min(top, viewportBottom - buttonHeight));
  }

  top = Math.max(viewportTop, Math.min(top, viewportBottom - buttonHeight));
  left = Math.max(viewportLeft, Math.min(left, viewportRight - buttonWidth));

  button.style.top = `${top}px`;
  button.style.left = `${left}px`;
  button.style.display = "block";
}

export function isValidSelection(selection: Selection | null): boolean {
  if (sessionStorage.getItem(SESSION_STORAGE_KEYS.IN_SIDE_PANEL)) {
    logger.debug("IN_SIDE_PANEL is true, skipping selection popup");
    return false;
  }

  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    return false;
  }

  const selectedText = selection.toString().trim();
  if (!isValidWordCount(selectedText)) {
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

export function getSelectedText(): string {
  return window.getSelection()?.toString().trim() || "";
}

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

export async function sendSelectionToSidePanel(
  text: string,
  formatType: ContextMenuValue = ContextMenu.AskMyAi,
  customPrompt?: string,
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
