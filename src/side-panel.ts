import { URLs, MessageAction } from "./constants";
import { logger } from "./logger";
import type { AiType, ExtIframeHandshakeRespMessage, SelectionInfoRespMessage } from "./types";
import { ExtStorage } from "./storage";
import { copyToClipboard } from "./utils";

let iframe: HTMLIFrameElement | null = null;

const sendMessageToContent = (msg: ExtIframeHandshakeRespMessage | SelectionInfoRespMessage) => {
  if (!iframe) {
    logger.warn("sendMessageToContent(): iframe is undefined");
    return;
  }

  if (!iframe.contentWindow) {
    logger.warn("sendMessageToContent():iframe.contentWindow is undefined");
    return;
  }

  iframe.contentWindow.postMessage(msg, "*");
};

window.onmessage = async (e) => {
  if (e.data.action === MessageAction.EXT_IFRAME_HANDSHAKE_INIT) {
    if (e.data.extId === chrome.runtime.id) {
      const msg: ExtIframeHandshakeRespMessage = {
        action: MessageAction.EXT_IFRAME_HANDSHAKE_RESP,
        extId: chrome.runtime.id,
      };
      sendMessageToContent(msg);
    } else {
      logger.error("Unexpected message from iframe: " + JSON.stringify(e.data));
    }
  } else if (e.data.action === MessageAction.SELECTION_INFO_REQ) {
    const selectionInfo = await ExtStorage.session.getSelectionInfo();
    if (selectionInfo) {
      const msg: SelectionInfoRespMessage = {
        action: MessageAction.SELECTION_INFO_RESP,
        selectionInfo,
      };
      sendMessageToContent(msg);
    }
  }
};

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.action === MessageAction.SELECTION_INFO_SAVED) {
    const msg: SelectionInfoRespMessage = {
      action: MessageAction.SELECTION_INFO_RESP,
      selectionInfo: message.selectionInfo,
    };

    sendMessageToContent(msg);

    await copyToClipboard(msg.selectionInfo.text);
  }
});

// Load saved preferences
document.addEventListener("DOMContentLoaded", async () => {
  // Create icon sidebar
  const sidebar = document.getElementById("ai-sidebar");
  if (!sidebar) {
    logger.error("AI sidebar element not found!");
    return;
  }

  // Create icons for each AI
  for (const [key, value] of Object.entries(URLs)) {
    const iconContainer = document.createElement("div");
    iconContainer.className = "ai-icon";
    iconContainer.dataset.aiType = key;
    iconContainer.title = value.label;

    // Load SVG content
    try {
      const iconUrl = chrome.runtime.getURL(value.icon);
      const response = await fetch(iconUrl);
      const svgContent = await response.text();
      iconContainer.innerHTML = svgContent;
    } catch (error) {
      logger.error(`Failed to load icon for ${key}:`, error);
      // Fallback to text
      iconContainer.innerHTML = `<div style="color: white; font-size: 10px; text-align: center;">${value.label.substring(
        0,
        3
      )}</div>`;
    }

    iconContainer.addEventListener("click", async () => {
      try {
        // Remove active class from all icons
        sidebar.querySelectorAll(".ai-icon").forEach((icon) => icon.classList.remove("active"));
        // Add active class to clicked icon
        iconContainer.classList.add("active");

        await loadAIInIframe(key as AiType);
      } catch (error) {
        logger.error("icon click event listener error:", error);
      }
    });

    sidebar.appendChild(iconContainer);
  }

  // Set initial active AI
  let selectedAI = await ExtStorage.local.getSelectedAI();
  selectedAI = selectedAI && selectedAI in URLs ? selectedAI : (Object.keys(URLs)[0] as AiType);

  // Mark the selected AI as active
  const activeIcon = sidebar.querySelector(`[data-ai-type="${selectedAI}"]`);
  if (activeIcon) {
    activeIcon.classList.add("active");
  }

  loadAIInIframe(selectedAI);
});

async function loadAIInIframe(aiType: AiType) {
  const currentAiConfig = URLs[aiType];

  // save currently selected AI in storage as previous AI
  const prevSelectedAi = await ExtStorage.local.getSelectedAI();
  if (prevSelectedAi) {
    await ExtStorage.local.setPrevSelectedAI(prevSelectedAi);
  }

  // save currently selected AI in storage
  await ExtStorage.local.setSelectedAI(aiType);

  // Show the AI container with loading message
  const container = document.getElementById("ai-container");
  if (!container) {
    logger.error("AI container element not found!");
    return;
  }

  const oldIframe = document.getElementById("ai-iframe");
  if (oldIframe) {
    oldIframe.remove();
  }

  const newIframe = document.createElement("iframe");
  iframe = newIframe;
  newIframe.id = "ai-iframe";
  newIframe.style.cssText = "width: 100%; height: 100%; border: none;";
  newIframe.allow = "camera; clipboard-write; fullscreen; microphone; geolocation";
  newIframe.src = currentAiConfig.url;

  // Append iframe to container
  container.appendChild(newIframe);
  container.style.display = "block";

  newIframe.onload = async () => {
    logger.log(`✅ Successfully loaded ${aiType} in iframe!`);
  };

  newIframe.onerror = (e) => {
    logger.error(`❌ Failed to load ${aiType} in iframe:`, e);

    // Fallback: show a message with link to open in new tab

    // Create fallback content without inline scripts
    const fallbackDiv = document.createElement("div");
    fallbackDiv.style.cssText =
      "padding:20px;text-align:center;font-family:Arial;background:#f8f9fa;height:100%;display:flex;align-items:center;justify-content:center;";
    fallbackDiv.innerHTML = `
      <div style="background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);max-width:300px;">
        <h3 style="margin:0 0 10px 0;color:#dc3545;">Cannot Embed ${currentAiConfig.url}</h3>
        <p style="margin:0 0 15px 0;color:#666;">Security restrictions prevent embedding this AI service.</p>
        <button id="fallback-open-btn" style="background:#007bff;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;">
          Open in New Tab
        </button>
      </div>
    `;

    // Clear iframe and show fallback
    newIframe.src = "about:blank";
    newIframe.srcdoc = "";
    newIframe.style.display = "none";

    // Replace container content with fallback
    const container = document.getElementById("ai-container");
    if (container) {
      container.innerHTML = "";
      container.appendChild(fallbackDiv);
      container.style.display = "block";

      // Add event listener to the button
      setTimeout(() => {
        const openBtn = document.getElementById("fallback-open-btn");
        if (openBtn) {
          openBtn.addEventListener("click", () => {
            chrome.tabs.create({ url: currentAiConfig.url, active: true });
          });
        }
      }, 100);
    }
  };
}
