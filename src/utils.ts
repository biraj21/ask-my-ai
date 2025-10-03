import { logger } from "./logger";

/**
 * Copies text to clipboard
 * @param text - The text to copy
 * @returns Promise that resolves to true if successful, false otherwise
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    logger.debug("Failed to copy to clipboard:", error);

    // Fallback to execCommand
    try {
      if (!document.queryCommandSupported("copy")) {
        throw new Error("copy command not supported");
      }

      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      logger.log("Fallback copy successful");

      return successful;
    } catch (fallbackError) {
      logger.error("Fallback copy also failed:", fallbackError);
      return false;
    }
  }
};

const isItMac = () => {
  if (navigator.platform) {
    return navigator.platform.toUpperCase().includes("MAC");
  } else if (navigator.userAgent) {
    return navigator.userAgent.toUpperCase().includes("MAC");
  } else if ("userAgentData" in navigator) {
    return (navigator.userAgentData as any).platform.toUpperCase().includes("MAC");
  }

  return false;
};

/**
 * Injects text into an element
 * @param text - The text to inject
 * @param element
 */
export const injectText = (text: string, element: Element) => {
  const setValue = () => {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      element.value = text;
    } else {
      (element as any).innerText = text;
    }
  };

  const getValue = () => {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return element.value;
    } else {
      return (element as any).innerText;
    }
  };

  // set the value
  setValue();

  // focus the element
  if ("focus" in element) {
    (element as any).focus();
  }

  // Trigger multiple events to ensure the site recognizes the change
  const inputEvent = new Event("input", { bubbles: true });
  element.dispatchEvent(inputEvent);

  const changeEvent = new Event("change", { bubbles: true });
  element.dispatchEvent(changeEvent);

  // Also try keyboard events
  const keydownEvent = new KeyboardEvent("keydown", { bubbles: true });
  element.dispatchEvent(keydownEvent);

  const keyupEvent = new KeyboardEvent("keyup", { bubbles: true });
  element.dispatchEvent(keyupEvent);

  // my friend github.com/PrashanthKumar0 came up with this so that it works on Perplexity too!!
  // why this is needed? because when you set innerText on perplexity's contenteditable div,
  // and if your print it again, it will show the old text so basically it remains unchanged
  // hence we trigger paste to make it work
  // and this paste logic is not working on sits like gemini and AI studio
  // so we need both logic to make it work on all sites
  if (getValue() !== text) {
    logger.debug("trying to set value WITH pasting");

    const isMac = isItMac();

    // select all (Ctrl+A / Cmd+A)
    const selectAllEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "a",
      code: "KeyA",
      ctrlKey: !isMac,
      metaKey: isMac,
      keyCode: 65,
      which: 65,
    });

    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    const pasteEvent = new ClipboardEvent("paste", {
      clipboardData: dt,
      bubbles: true,
      cancelable: false,
      composed: true,
    });

    element.dispatchEvent(selectAllEvent);
    element.dispatchEvent(pasteEvent);
  } else {
    logger.debug("text value set successfully WITHOUT pasting");
  }
};

export const timeout = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
