import { EXT_NAME, ContextMenu } from "@/constants";

// Create the sparkles button element with Shadow DOM
export function createAskButton(): HTMLDivElement {
  const button = document.createElement("div");
  button.id = "ask-my-ai-sparkles-btn";

  // Create Shadow DOM for complete CSS isolation
  const shadow = button.attachShadow({ mode: "open" });

  const iconUrl = chrome.runtime.getURL("icons/icon48.png");

  shadow.innerHTML = `
    <style>
      :host {
        position: absolute;
        z-index: 2147483647;
        display: none;
        cursor: pointer;
      }
      
      .button-wrapper {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 10px;
        padding: 2px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 
          0 2px 8px rgba(0, 0, 0, 0.15),
          0 0 0 1px rgba(255, 255, 255, 0.2) inset;
        line-height: 0;
        position: relative;
        overflow: hidden;
      }
      
      .button-wrapper::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 100%);
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      .button-wrapper:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow: 
          0 4px 12px rgba(0, 0, 0, 0.2),
          0 0 0 1px rgba(255, 255, 255, 0.3) inset,
          0 0 20px rgba(102, 126, 234, 0.4);
      }
      
      .button-wrapper:hover::before {
        opacity: 1;
      }
      
      .button-wrapper:active {
        transform: scale(1.02) translateY(-1px);
      }
      
      img {
        display: block;
        border-radius: 6px;
        width: 28px;
        height: 28px;
        position: relative;
        z-index: 1;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
      }
    </style>
    <div class="button-wrapper">
      <img src="${iconUrl}" alt="${EXT_NAME}" title="${EXT_NAME}">
    </div>
  `;

  return button;
}

// Create the menu that appears on hover
export function createSelectionMenu(): HTMLDivElement {
  const menu = document.createElement("div");
  menu.id = "ask-my-ai-selection-menu";

  const shadow = menu.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      :host {
        position: absolute;
        z-index: 2147483647;
        display: none;
        opacity: 0;
        transform: scale(0.95) translateY(-5px);
        transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      :host(.show) {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      
      .menu-container {
        background: #1a1b26;
        backdrop-filter: blur(12px);
        border-radius: 12px;
        box-shadow: 
          0 10px 25px -5px rgba(0, 0, 0, 0.3),
          0 8px 10px -6px rgba(0, 0, 0, 0.2),
          0 0 0 1px rgba(255, 255, 255, 0.1);
        padding: 6px;
        min-width: 200px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
      }
      
      .menu-item {
        padding: 10px 14px;
        cursor: pointer;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        color: #e5e7eb;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        display: block;
        position: relative;
        user-select: none;
      }
      
      .menu-item:hover {
        background: rgba(102, 126, 234, 0.2);
        color: #ffffff;
      }
      
      .menu-item:active {
        transform: scale(0.98);
      }
      
      .menu-divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1) 50%, transparent);
        margin: 6px 0;
      }
      
      .custom-input-container {
        padding: 6px;
      }
      
      .custom-input {
        width: 100%;
        padding: 10px 12px;
        border: 1.5px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        font-family: inherit;
        outline: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-sizing: border-box;
        background: rgba(255, 255, 255, 0.05);
        color: #ffffff;
      }
      
      .custom-input:focus {
        border-color: #667eea;
        background: rgba(255, 255, 255, 0.08);
        box-shadow: 
          0 0 0 3px rgba(102, 126, 234, 0.15),
          0 1px 2px rgba(0, 0, 0, 0.1);
      }
      
      .custom-input::placeholder {
        color: rgba(255, 255, 255, 0.4);
        font-weight: 400;
      }
      
      .input-hint {
        font-size: 11px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.4);
        margin-top: 6px;
        padding: 0 6px;
        letter-spacing: 0.01em;
      }
    </style>
    <div class="menu-container">
      <div class="menu-item" data-action="${ContextMenu.Explain}">Explain</div>
      <div class="menu-item" data-action="${ContextMenu.Summarize}">Summarize</div>
      <div class="menu-item" data-action="${ContextMenu.Simplify}">ELI5 (Simplify)</div>
      <div class="menu-divider"></div>
      <div class="custom-input-container">
        <input 
          type="text" 
          class="custom-input" 
          placeholder="Custom prompt..."
          autocomplete="off"
        />
        <div class="input-hint">Enter to send | Esc to cancel</div>
      </div>
    </div>
  `;

  return menu;
}

// Position menu relative to button
export function positionMenu(menu: HTMLElement, button: HTMLElement) {
  const buttonRect = button.getBoundingClientRect();
  const menuWidth = 220; // Approximate menu width
  const offset = 10;

  // Position to the right of button by default
  let left = buttonRect.right + offset + window.scrollX;
  let top = buttonRect.top + window.scrollY;

  // Check if menu would overflow viewport
  if (left + menuWidth > window.innerWidth + window.scrollX) {
    // Position to the left instead
    left = buttonRect.left - menuWidth - offset + window.scrollX;
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.display = "block";

  // Trigger animation
  requestAnimationFrame(() => {
    menu.classList.add("show");
  });
}
