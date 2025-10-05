import { MessageAction, INJECTION_WINDOW_MS } from "./constants";
import { logger } from "./logger";
import type { ExtIframeHandshakeRespMessage, SelectionInfoRespMessage } from "./types";
import { injectText } from "./utils";

let lastSelection: SelectionInfoRespMessage | null = null;

/**
 * After first injection, we will only inject if the time since the first injection
 * is less than the injection window.
 * Why? Because we don't want to inject into inputs that are likely post-send inputs,
 * i.e rendered after user hit the send button.
 */
let firstInjectionTimestamp: number | null = null;

async function waitForIframeHandshake(timeoutMs: number = 500) {
  let listener: ((event: MessageEvent) => void) | null = null;
  let timeoutId: number | undefined = undefined;
  try {
    const handshakeStart = Date.now();

    // init handshake
    window.parent.postMessage(
      {
        action: MessageAction.EXT_IFRAME_HANDSHAKE_INIT,
        extId: chrome.runtime.id,
      },
      "*"
    );

    // set up a promise to wait for handshake response
    const iframeHandshakePromise = new Promise((resolve, reject) => {
      listener = (e: MessageEvent) => {
        logger.debug("iframe handshake message listener received", e.data, window.location.href);
        if (e.data.action === MessageAction.EXT_IFRAME_HANDSHAKE_RESP) {
          const msg: ExtIframeHandshakeRespMessage = {
            action: MessageAction.EXT_IFRAME_HANDSHAKE_RESP,
            extId: chrome.runtime.id,
          };
          if (msg.extId === chrome.runtime.id) {
            resolve(undefined);
          } else {
            reject(new Error("Unexpected message from iframe: " + JSON.stringify(e.data)));
          }
        } else if (e.data.action === MessageAction.SELECTION_INFO_RESP) {
          const msg: SelectionInfoRespMessage = {
            action: MessageAction.SELECTION_INFO_RESP,
            selectionInfo: e.data.selectionInfo,
          };

          lastSelection = msg;
        }
      };

      window.addEventListener("message", listener);
    });

    const timeoutPromise = new Promise((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Handshake timeout"));
      }, timeoutMs);
    });

    await Promise.race([iframeHandshakePromise, timeoutPromise]);

    logger.debug("Handshake completed in", Date.now() - handshakeStart, "ms");
  } catch (err) {
    throw err;
  } finally {
    clearTimeout(timeoutId);

    if (listener) {
      window.removeEventListener("message", listener);
    }
  }
}

async function init() {
  const isIframe = window.self !== window.top;
  if (!isIframe) {
    return;
  }

  await waitForIframeHandshake();
  logger.debug("iframe ready", window.location.href);

  // Intercept all link clicks and open in new tab instead of navigating in iframe
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");

      if (link && link.href) {
        // Don't intercept same-page anchors (e.g., #section)
        const linkUrl = new URL(link.href);
        const currentUrl = new URL(window.location.href);

        if (linkUrl.origin !== currentUrl.origin || linkUrl.pathname !== currentUrl.pathname) {
          e.preventDefault();
          e.stopPropagation();
          // logger.debug("Intercepting link click, opening in new tab:", link.href);
          window.open(link.href, "_blank");
        }
      }
    },
    true
  );

  let allPromptInputs = new Set<HTMLElement>();

  const getPromptElements = () => {
    // Keywords to identify AI prompt inputs
    const chatKeywords = [
      "message",
      "prompt",
      "ask",
      "chat",
      "conversation",
      "question",

      // for google
      "search",
    ];

    const aiPlatformNames = [
      "chatgpt",
      "claude",
      "gemini",
      "perplexity",
      "openai",
      "anthropic",
      "copilot",
      "bard",
      "deepseek",
      "grok",
      "mistral",
    ];

    const keywords = [...chatKeywords, ...aiPlatformNames];

    // Check if an element matches our keyword criteria
    const isPromptInput = (element: Element): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) {
        return true;
      }

      const attributesToCheck = [
        element.id,
        element.className,
        element.getAttribute("aria-label"),
        element.getAttribute("placeholder"),
        element.getAttribute("aria-placeholder"),
        element.getAttribute("data-placeholder"),
        element.getAttribute("name"),
      ];

      // Check if any attribute contains any of our keywords (case-insensitive)
      return attributesToCheck.some((attribute) => {
        if (!attribute) {
          return false;
        }

        const lowerCaseAttribute = attribute.toLowerCase();
        return keywords.some((keyword) => lowerCaseAttribute.includes(keyword));
      });
    };

    // Find all potential input elements
    const allContentEditables = Array.from(document.querySelectorAll("[contenteditable]"));
    const allTextareas = Array.from(document.querySelectorAll("textarea"));
    const allInputElements = [...allContentEditables, ...allTextareas];

    // Filter to only those matching our keywords
    const matchingInputElements = allInputElements.filter(isPromptInput);

    return matchingInputElements;
  };

  window.addEventListener("message", (e) => {
    if (e.data.action === MessageAction.SELECTION_INFO_RESP) {
      const msg: SelectionInfoRespMessage = {
        action: MessageAction.SELECTION_INFO_RESP,
        selectionInfo: e.data.selectionInfo,
      };

      logger.debug("Received response:", e);

      lastSelection = msg;

      const newInputElements = getPromptElements();
      newInputElements.forEach((el) => allPromptInputs.add(el));

      if (allPromptInputs.size === 0) {
        logger.debug("No prompt input elements found yet.");
        return;
      }

      injectTextIntoPromptInputs(msg);
    } else if (e.data.action === MessageAction.OPEN_CURRENT_URL_IN_TAB) {
      // Open current URL in a new tab
      // logger.debug("Opening current URL in new tab:", window.location.href);
      window.open(window.location.href, "_blank");
    }
  });

  // Function to check for new prompt inputs and handle them
  const checkForPromptInputs = () => {
    const sizeBefore = allPromptInputs.size;
    const newInputElements = getPromptElements();
    for (const elem of newInputElements) {
      allPromptInputs.add(elem);
    }

    if (allPromptInputs.size > sizeBefore) {
      // New inputs found
      if (lastSelection) {
        // Check if we're within the injection window
        if (firstInjectionTimestamp === null) {
          // First injection - always inject
          injectTextIntoPromptInputs(lastSelection, newInputElements);
        } else {
          // Subsequent injection - only inject if within time window
          const timeSinceFirstInjection = Date.now() - firstInjectionTimestamp;
          if (timeSinceFirstInjection <= INJECTION_WINDOW_MS) {
            logger.debug(`Injecting into new input (${timeSinceFirstInjection}ms since first injection)`);
            injectTextIntoPromptInputs(lastSelection, newInputElements);
          } else {
            logger.debug(
              `Skipping injection - outside ${INJECTION_WINDOW_MS}ms window (${timeSinceFirstInjection}ms elapsed)`
            );
            lastSelection = null;
          }
        }
      } else {
        // No pending selection, request one
        window.parent.postMessage(
          {
            action: MessageAction.SELECTION_INFO_REQ,
          },
          "*"
        );
      }
    }
  };

  // Initial check for existing prompt inputs
  checkForPromptInputs();

  // Set up MutationObserver to watch for DOM changes
  const observer = new MutationObserver((mutations) => {
    // Check if any mutations added new elements
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        checkForPromptInputs();
        break; // Only need to check once per batch of mutations
      }
    }
  });

  // Start observing the document for DOM changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Cleanup observer when the page unloads
  window.addEventListener("beforeunload", () => {
    observer.disconnect();
  });

  function injectTextIntoPromptInputs(selection: SelectionInfoRespMessage, inputElementsArg?: HTMLElement[]) {
    const elements = new Set(inputElementsArg || allPromptInputs || []);
    const text = selection.selectionInfo.text;

    // Record timestamp of first injection
    if (firstInjectionTimestamp === null) {
      firstInjectionTimestamp = Date.now();
      logger.debug("First injection at", firstInjectionTimestamp);
    }

    for (const el of elements) {
      if (el.isConnected) {
        logger.debug("injecting text", text, "into input:", el);
        injectText(text, el);
      } else {
        logger.debug("element is not connected, skipping", el);
      }
    }
  }
}

async function main() {
  try {
    await init();
  } catch (error) {
    logger.error(`Error during init ${window.location.href}:`, error);
  }
}

main();
