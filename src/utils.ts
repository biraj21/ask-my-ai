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
