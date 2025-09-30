import { EXT_NAME } from "./constants";

/**
 * Logger wrapper that prefixes all console methods with the extension name
 */
export const logger = {
  log: (...args: any[]) => {
    console.log(`[${EXT_NAME}]`, ...args);
  },

  warn: (...args: any[]) => {
    console.warn(`[${EXT_NAME}]`, ...args);
  },

  debug: (...args: any[]) => {
    console.debug(`[${EXT_NAME}]`, ...args);
  },

  error: (...args: any[]) => {
    console.error(`[${EXT_NAME}]`, ...args);
  },
};
