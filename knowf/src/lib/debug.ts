const DEBUG = process.env.NODE_ENV === "development";

export const debug = {
  log: (...args: any[]) => {
    if (DEBUG) console.log("[DEBUG]", ...args);
  },
  error: (...args: any[]) => {
    if (DEBUG) {
      console.error("[ERROR]", ...args);
      console.error(new Error().stack); // Log the entire stack trace
    }
  },
  warn: (...args: any[]) => {
    if (DEBUG) console.warn("[WARN]", ...args);
  },
};
