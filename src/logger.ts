import { EXT_NAME } from "./constants";

const tag = () => `[${EXT_NAME}] (${new Date().toLocaleString()})`;

/**
 * Logger wrapper that prefixes all console methods with the extension name
 */
export const logger = {
  log: (...args: any[]) => {
    console.log(tag(), ...args);
  },

  warn: (...args: any[]) => {
    console.warn(tag(), ...args);
  },

  debug: (...args: any[]) => {
    console.debug(tag(), ...args);
  },

  error: (...args: any[]) => {
    console.error(tag(), ...args);
  },
};
