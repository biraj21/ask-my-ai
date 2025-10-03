import { MessageAction } from "./constants";
import { logger } from "./logger";
import type { ExtIframeHandshakeRespMessage, SelectionInfoRespMessage } from "./types";
import { injectText, timeout } from "./utils";

let pendingSelection: SelectionInfoRespMessage | null = null;

async function waitForIframeHandshake(timeout: number = 500) {
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
            forced: e.data.forced,
            currentAi: e.data.currentAi,
            previousAi: e.data.previousAi,
          };

          pendingSelection = msg;
        }
      };

      window.addEventListener("message", listener);
    });

    const timeoutPromise = new Promise((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Handshake timeout"));
      }, timeout);
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

  let allPromptInputs = new Set<Element>();

  const getPromptElement = () => {
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
    const isPromptInput = (element: Element): boolean => {
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
        forced: e.data.forced,
        currentAi: e.data.currentAi,
        previousAi: e.data.previousAi,
      };

      logger.debug("Received response:", e);

      const newInputElements = getPromptElement();
      newInputElements.forEach((el) => allPromptInputs.add(el));

      if (allPromptInputs.size === 0) {
        logger.debug("No prompt input elements found yet.");
        pendingSelection = msg;
        return;
      }

      injectTextIntoPromptInputs(msg);
    }
  });

  let attempts = 0;

  // TODO: fix this shit
  async function fuck() {
    ++attempts;

    const sizeBefore = allPromptInputs.size;
    const newInputElements = getPromptElement();
    for (const elem of newInputElements) {
      allPromptInputs.add(elem);
    }

    if (allPromptInputs.size > sizeBefore) {
      if (pendingSelection) {
        injectTextIntoPromptInputs(pendingSelection, newInputElements);
      } else {
        window.parent.postMessage(
          {
            action: MessageAction.SELECTION_INFO_REQ,
          },
          "*"
        );
      }
    }

    if (attempts <= 10) {
      await timeout(500);
      fuck();
    } else {
      pendingSelection = null; // selection's consumed
    }
  }

  fuck();

  function injectTextIntoPromptInputs(selection: SelectionInfoRespMessage, inputElementsArg?: Element[]) {
    logger.debug("injecting selection", selection, "into input:", inputElementsArg);
    if (
      !selection.forced &&
      selection.previousAi === selection.currentAi &&
      Date.now() - selection.selectionInfo.timestamp > 5000
    ) {
      logger.debug("selected text older than 5 seconds.. skipping");
      return;
    }

    const elements = new Set(inputElementsArg || allPromptInputs || []);

    const text = selection.selectionInfo.text;

    for (const el of elements) {
      logger.debug("injecting text", text, "into input:", el);

      // then inject the text
      injectText(text, el);
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
