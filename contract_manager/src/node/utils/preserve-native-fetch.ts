/**
 * Pin `globalThis.fetch` to Node's native fetch.
 *
 * `near-api-js@1.1.0` (pulled in transitively by `@certusone/wormhole-sdk`)
 * unconditionally replaces `globalThis.fetch` with `node-fetch` at module
 * load. That breaks libraries that expect a web `Response.body` exposing
 * `getReader()` (e.g. `fuels`, which fails with
 * `TypeError: responseClone.body?.getReader is not a function`).
 *
 * Import this module *before* anything that loads the wormhole SDK. Native
 * fetch is available on every Node version we support, so the polyfill is
 * never actually needed; we just have to stop libraries from clobbering it.
 */
const nativeFetch = globalThis.fetch;
Object.defineProperty(globalThis, "fetch", {
  get: () => nativeFetch,
  set: () => {
    // Swallow writes from polyfilling libraries; native fetch works fine.
  },
  configurable: true,
});

/**
 * Re-exported so callers can use a named import (`import { preserveNativeFetch }
 * from …`) instead of a side-effect-only `import "…"`.  Side-effect-only imports
 * are not rewritten by the build tool (ts-duality) when it rewrites file
 * extensions for ESM output, causing ERR_MODULE_NOT_FOUND at runtime.
 */
export const preserveNativeFetch = true;
