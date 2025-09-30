import { URLs, MessageType } from "./constants";
import { logger } from "./logger";

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

  const result = await chrome.storage.local.get("selectedAI");
  const selectedAi = result.selectedAI in URLs ? result.selectedAI : Object.keys(URLs)[0];
  loadAIInIframe(selectedAi);
  select.value = selectedAi;

  select.addEventListener("change", (e) => {
    const selectedAI = (e.target as HTMLSelectElement).value;
    loadAIInIframe(selectedAI as keyof typeof URLs);
  });
});

async function loadAIInIframe(aiType: keyof typeof URLs) {
  const currentAiConfig = URLs[aiType];

  chrome.storage.local.set({ selectedAI: aiType });

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

  const iframe = document.createElement("iframe");
  iframe.id = "ai-iframe";
  iframe.style.cssText = "width: 100%; height: 100%; border: none;";
  iframe.allow = "camera; clipboard-write; fullscreen; microphone; geolocation";
  iframe.src = currentAiConfig.url;

  // Append iframe to container
  container.appendChild(iframe);
  container.style.display = "block";

  window.onmessage = (e) => {
    if (e.data.type === MessageType.EXT_IFRAME_HANDSHAKE_INIT) {
      if (e.data.extId === chrome.runtime.id) {
        if (!iframe.contentWindow) {
          logger.error("iframe.contentWindow is undefined");
          return;
        }

        iframe.contentWindow.postMessage(
          {
            type: MessageType.EXT_IFRAME_HANDSHAKE_RESP,
            extId: chrome.runtime.id,
          },
          "*"
        );
      } else {
        logger.error("Unexpected message from iframe: " + JSON.stringify(e.data));
      }
    }
  };

  iframe.onload = async () => {
    logger.log(`✅ Successfully loaded ${aiType} in iframe (${iframe.id})!`);

    if (!iframe.contentWindow) {
      logger.error("iframe.contentWindow is undefined");
      return;
    }
  };

  iframe.onerror = (e) => {
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
    iframe.src = "about:blank";
    iframe.srcdoc = "";
    iframe.style.display = "none";

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
