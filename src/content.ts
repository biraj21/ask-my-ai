import { MessageType } from "./constants";
import { logger } from "./logger";
import type { PortMessage, SelectionInfo } from "./types";

async function waitForIframeHandshake(timeout: number = 500) {
  let listener: ((event: MessageEvent) => void) | null = null;
  let timeoutId: number | undefined = undefined;
  try {
    const handshakeStart = Date.now();

    // init handshake
    window.parent.postMessage(
      {
        type: MessageType.EXT_IFRAME_HANDSHAKE_INIT,
        extId: chrome.runtime.id,
      },
      "*"
    );

    // set up a promise to wait for handshake response
    const iframeHandshakePromise = new Promise((resolve, reject) => {
      listener = (e: MessageEvent) => {
        logger.debug("iframe ready message", e.data, window.location.href);
        if (e.data.type === MessageType.EXT_IFRAME_HANDSHAKE_RESP) {
          if (e.data.extId === chrome.runtime.id) {
            resolve(undefined);
          } else {
            reject(new Error("Unexpected message from iframe: " + JSON.stringify(e.data)));
          }
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

  const port = chrome.runtime.connect({ name: "content-background-port" });

  await new Promise((resolve, reject) => {
    const connectionMsgListener = (message: PortMessage) => {
      if (message.action === "connected") {
        logger.debug("Received connection acknowledgment from background script:", message);
        resolve(undefined);
      } else {
        logger.log("Unexpected message from background script while waiting for connection acknowledgement:", message);
        reject(new Error("Unexpected message from background script"));
      }

      // remove this listener after first message
      port.onMessage.removeListener(connectionMsgListener);
    };

    port.onMessage.addListener(connectionMsgListener);
  });

  let pendingSelection: SelectionInfo | null = null;
  let allPromptInputs = new Set<Element>();

  const getPromptElement = () => {
    const inputElements = [];
    let $el = document.querySelector("[contenteditable]");
    if ($el) {
      inputElements.push($el);
    }

    $el = document.querySelector("textarea");
    if ($el) {
      inputElements.push($el);
    }

    $el = document.querySelector("input[type=text]");
    if ($el) {
      inputElements.push($el);
    }

    return inputElements;
  };

  port.onMessage.addListener((message) => {
    if (message.action === "getSelection") {
      logger.debug("Received response:", message);

      const newInputElements = getPromptElement();
      newInputElements.forEach((el) => allPromptInputs.add(el));

      if (allPromptInputs.size === 0) {
        logger.debug("No prompt input elements found yet.");
        pendingSelection = message.selectionInfo;
        return;
      }

      if (message.selectionInfo) {
        injectText(message.selectionInfo);
      }
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
        injectText(pendingSelection, newInputElements);
      } else {
        port.postMessage({
          action: "getSelection",
        });
      }
    }

    if (attempts <= 10) {
      setTimeout(fuck, 500);
    } else {
      pendingSelection = null; // selection's consumed
    }
  }

  fuck();

  function injectText(selection: SelectionInfo, inputElementsArg?: Element[]) {
    if (selection.previousAi === selection.currentAi && Date.now() - selection.timestamp > 5000) {
      logger.debug("selected text older than 5 seconds.. skipping");
      return;
    }

    const elements = new Set(inputElementsArg || allPromptInputs || []);

    const text = selection.text;

    for (const inputElement of elements) {
      logger.debug("injecting text", text, "into input:", inputElement);

      // (inputElement as any).focus();

      if (inputElement instanceof HTMLTextAreaElement || inputElement instanceof HTMLInputElement) {
        inputElement.value = text;
      } else {
        (inputElement as any).innerText = text;
      }

      // Trigger multiple events to ensure the site recognizes the change
      const inputEvent = new Event("input", { bubbles: true });
      inputElement.dispatchEvent(inputEvent);

      const changeEvent = new Event("change", { bubbles: true });
      inputElement.dispatchEvent(changeEvent);

      // Also try keyboard events
      const keydownEvent = new KeyboardEvent("keydown", { bubbles: true });
      inputElement.dispatchEvent(keydownEvent);

      const keyupEvent = new KeyboardEvent("keyup", { bubbles: true });
      inputElement.dispatchEvent(keyupEvent);
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
