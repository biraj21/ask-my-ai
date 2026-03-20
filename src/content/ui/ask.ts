import { EXT_NAME, ContextMenu } from "@/constants";
import { applyShadowStyles, escapeHtml, renderTemplate } from "./shadow";
import askButtonStyles from "./ask.css?raw";
import askMenuStyles from "./ask-menu.css?raw";
import askButtonTemplate from "./ask-button.html?raw";
import askMenuTemplate from "./ask-menu.html?raw";

// Create the sparkles button element with Shadow DOM
export function createAskButton(): HTMLDivElement {
  const button = document.createElement("div");
  button.id = "ask-my-ai-sparkles-btn";

  const shadow = button.attachShadow({ mode: "open" });
  applyShadowStyles(shadow, askButtonStyles);

  const iconUrl = chrome.runtime.getURL("icons/icon48.png");

  shadow.innerHTML = renderTemplate(askButtonTemplate, {
    ICON_URL: escapeHtml(iconUrl),
    EXT_NAME: escapeHtml(EXT_NAME),
  });

  return button;
}

// Create the menu that appears on hover
export function createSelectionMenu(): HTMLDivElement {
  const menu = document.createElement("div");
  menu.id = "ask-my-ai-selection-menu";

  const shadow = menu.attachShadow({ mode: "open" });
  applyShadowStyles(shadow, askMenuStyles);

  shadow.innerHTML = renderTemplate(askMenuTemplate, {
    ACTION_EXPLAIN: escapeHtml(ContextMenu.Explain),
    ACTION_SUMMARIZE: escapeHtml(ContextMenu.Summarize),
    ACTION_SIMPLIFY: escapeHtml(ContextMenu.Simplify),
  });

  return menu;
}

// Position menu relative to button
export function positionMenu(menu: HTMLElement, button: HTMLElement) {
  const buttonRect = button.getBoundingClientRect();
  const offset = 10;

  menu.style.display = "block";
  menu.style.visibility = "hidden";

  const menuWidth = menu.offsetWidth || 220;

  let left = buttonRect.right + offset + window.scrollX;
  const top = buttonRect.top + window.scrollY;

  if (left + menuWidth > window.innerWidth + window.scrollX) {
    left = buttonRect.left - menuWidth - offset + window.scrollX;
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.display = "block";
  menu.style.visibility = "visible";

  requestAnimationFrame(() => {
    menu.classList.add("show");
  });
}
