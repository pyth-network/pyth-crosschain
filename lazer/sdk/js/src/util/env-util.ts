// we create this local-only type, which has assertions made to indicate
// that we do not know and cannot guarantee which JS environment we are in
const g = globalThis as Partial<{
  self: typeof globalThis.self;
  window: typeof globalThis.window;
}>;

/**
 * Detects if this code is running within any Service or WebWorker context.
 * @returns true if in a worker of some kind, false if otherwise
 */
export function envIsServiceOrWebWorker() {
  return (
    typeof WorkerGlobalScope !== "undefined" &&
    g.self instanceof WorkerGlobalScope
  );
}

/**
 * Detects if the code is running in a regular DOM or Web Worker context.
 * @returns true if running in a DOM or Web Worker context, false if running in Node.js
 */
export function envIsBrowser() {
  return g.window !== undefined;
}

/**
 * a convenience method that returns whether or not
 * this code is executing in some type of browser-centric environment
 *
 * @returns true if in the browser's main UI thread or in a worker, false if otherwise
 */
export function envIsBrowserOrWorker() {
  return envIsServiceOrWebWorker() || envIsBrowser();
}
