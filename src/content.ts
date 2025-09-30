import type { PortMessage, SelectionInfo } from "./types";

async function init() {
  const port = chrome.runtime.connect({ name: "content-background-port" });

  await new Promise((resolve, reject) => {
    const connectionMsgListener = (message: PortMessage) => {
      if (message.action === "connected") {
        console.debug("Received connection acknowledgment from background script:", message);
        resolve(undefined);
      } else {
        console.log("Unexpected message from background script while waiting for connection acknowledgement:", message);
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
      console.debug("Received response:", message);

      const newInputElements = getPromptElement();
      newInputElements.forEach((el) => allPromptInputs.add(el));

      if (allPromptInputs.size === 0) {
        console.debug("No prompt input elements found yet.");
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

    console.debug("birajlog allPromptInputs.size", allPromptInputs.size);

    if (allPromptInputs.size > sizeBefore) {
      if (pendingSelection) {
        injectText(pendingSelection, newInputElements);
      } else {
        console.debug("birajlog sending postMessage to getSelection");
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
    console.debug("birajlog injectText selection", selection);
    if (selection.previousAi === selection.currentAi && Date.now() - selection.timestamp > 3000) {
      console.debug("selected text older than 3 seconds.. skipping");
      return;
    }

    const elements = new Set(inputElementsArg || allPromptInputs || []);

    const text = selection.text;

    for (const inputElement of elements) {
      console.debug("injecting text", text, "into input:", inputElement);

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

const ignorePatterns = ["isolated-segment"];

function main() {
  if (ignorePatterns.some((pattern) => window.location.href.includes(pattern))) {
    return;
  }

  const isIframe = window.self !== window.top;
  if (isIframe) {
    init();
  }
}

main();
