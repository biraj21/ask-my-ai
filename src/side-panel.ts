import { URLs, MessageType } from "./constants";
import { logger } from "./logger";
import type { SelectionInfo } from "./types";
import { ExtStorage } from "./storage";

let iframe: HTMLIFrameElement | null = null;

const sendSelectionInfoToIframe = (selectionInfo: SelectionInfo) => {
  if (!iframe) {
    return;
  }

  if (!iframe.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    {
      action: MessageType.EXT_SELECTION_INFO_RESP,
      selectionInfo,
    },
    "*"
  );
};

window.onmessage = async (e) => {
  if (!iframe) {
    return;
  }

  if (!iframe.contentWindow) {
    logger.error("iframe.contentWindow is undefined");
    return;
  }

  if (e.data.action === MessageType.EXT_IFRAME_HANDSHAKE_INIT) {
    if (e.data.extId === chrome.runtime.id) {
      iframe.contentWindow.postMessage(
        {
          action: MessageType.EXT_IFRAME_HANDSHAKE_RESP,
          extId: chrome.runtime.id,
        },
        "*"
      );
    } else {
      logger.error("Unexpected message from iframe: " + JSON.stringify(e.data));
    }
  } else if (e.data.action === MessageType.EXT_SELECTION_INFO_REQ) {
    const selectionInfo = await ExtStorage.session.getSelectionInfo();
    if (selectionInfo) {
      sendSelectionInfoToIframe(selectionInfo);
    }
  }
};

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === MessageType.EXT_SELECTION_INFO_SAVED) {
    sendSelectionInfoToIframe(message.selectionInfo);
  }
});

// Load saved preferences
document.addEventListener("DOMContentLoaded", async () => {
  // Update dropdown options based on enabled AIs
  const select = document.getElementById("ai-select");
  if (!(select instanceof HTMLSelectElement)) {
    logger.error("AI select element not found!");
    return;
  }

  for (const [key, value] of Object.entries(URLs)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = value.label;
    select.appendChild(option);
  }

  let selectedAI = await ExtStorage.local.getSelectedAI();
  selectedAI = selectedAI in URLs ? selectedAI : Object.keys(URLs)[0];
  select.value = selectedAI;
  loadAIInIframe(selectedAI);

  select.addEventListener("change", (e) => {
    const selectedAI = (e.target as HTMLSelectElement).value;
    loadAIInIframe(selectedAI as keyof typeof URLs);
  });
});

async function loadAIInIframe(aiType: keyof typeof URLs) {
  const currentAiConfig = URLs[aiType];

  ExtStorage.local.setSelectedAI(aiType);

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
