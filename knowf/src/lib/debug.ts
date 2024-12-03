const DEBUG = process.env.NODE_ENV === "development";

export const debug = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: (...args: any[]) => {
    if (DEBUG) console.log("[DEBUG]", ...args);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => {
    if (DEBUG) {
      console.error("[ERROR]", ...args);
      console.error(new Error().stack); // Log the entire stack trace
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => {
    if (DEBUG) console.warn("[WARN]", ...args);
  },
};
