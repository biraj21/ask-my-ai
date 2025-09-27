async function init() {
  const port = chrome.runtime.connect({ name: "content-background-port" });

  await new Promise((resolve, reject) => {
    const connectionMsgListener = (message) => {
      if (message.action === "connected") {
        console.log("Received connection acknowledgment from background script:", message);
        resolve();
      } else {
        console.log("Unexpected message from background script while waiting for connection acknowledgement:", message);
        reject(new Error("Unexpected message from background script"));
      }

      // remove this listener after first message
      port.onMessage.removeListener(connectionMsgListener);
    };

    port.onMessage.addListener(connectionMsgListener);
  });

  let pendingSelectionText = null;
  let allPromptInputs = new Set();

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
    if (message.action === "getSelectionText") {
      console.log("Received response:", message);

      const newInputElements = getPromptElement();
      newInputElements.forEach((el) => allPromptInputs.add(el));

      if (allPromptInputs.size === 0) {
        console.log("No prompt input elements found yet.");
        pendingSelectionText = message.selectionText;
        return;
      }

      if (message.selectionText) {
        injectText(message.selectionText);
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

    console.log("birajlog fuck allPromptInputs.size", allPromptInputs.size);

    if (allPromptInputs.size > sizeBefore) {
      if (pendingSelectionText) {
        injectText(pendingSelectionText, newInputElements);
      } else {
        console.log("birajlog fuck sending postMessage to getSelectionText");

        port.postMessage({
          action: "getSelectionText",
        });
      }
    }

    if (attempts <= 10) {
      setTimeout(fuck, 500);
    }
  }

  fuck();

  function injectText(text, inputElementsArg) {
    inputElementsArg = new Set(inputElementsArg || allPromptInputs || []);

    for (const inputElement of inputElementsArg) {
      console.log("injecting text", text, "into input:", inputElement);

      inputElement.focus();
      if (inputElement instanceof HTMLTextAreaElement || inputElement instanceof HTMLInputElement) {
        inputElement.value = text;
      } else {
        inputElement.innerText = text;
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
