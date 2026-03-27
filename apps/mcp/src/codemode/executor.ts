/**
 * Code Mode executor — runs LLM-generated code in a Node.js vm context.
 *
 * The vm context exposes only: a `codemode` object whose methods call back
 * into the host via `hostCall`. No fetch, require, process, or globals are
 * available — the context is created with an empty sandbox.
 *
 * NOTE: Node's `vm` is NOT a security boundary (same process). We mitigate
 * known escape vectors (function constructor chains, host-realm return values)
 * by severing prototype chains and marshaling all data through JSON. Upgrade
 * to isolated-vm or Cloudflare Workers for stronger isolation if needed.
 */

import { createContext, runInContext, runInNewContext } from "node:vm";

export type ExecutionResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; logs?: string[] };

export interface ExecutorOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Host callback: (toolName, arg) => Promise<result> */
export type HostBindingFn = (toolName: string, arg: unknown) => Promise<unknown>;

/**
 * Marshal a host-realm value into a sandbox-realm value.
 * Serializes to JSON in the host, then parses inside the sandbox context
 * so the resulting object has sandbox-realm prototypes. This prevents
 * escape via `result.constructor.constructor("return process")()`.
 */
function marshalToSandbox(value: unknown, sandboxContext: object): unknown {
  if (value === undefined || value === null) return value;
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return undefined;
    // Parse inside the sandbox realm so prototypes belong to the sandbox
    return runInContext(`JSON.parse(${JSON.stringify(json)})`, sandboxContext);
  } catch {
    return String(value);
  }
}

export function createExecutor(options: ExecutorOptions = {}): {
  execute(code: string, hostCall: HostBindingFn): Promise<ExecutionResult>;
} {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function execute(
    code: string,
    hostCall: HostBindingFn,
  ): Promise<ExecutionResult> {
    try {
      // Create sandbox context first so we can marshal return values into it.
      const sandbox = createContext(Object.create(null));

      // Create a bridge function inside the sandbox that produces sandbox-realm
      // Promises. This prevents escape via un-awaited Promise prototype chains:
      // `codemode.get_symbols({}).constructor.constructor("return process")()`.
      type BridgeFn = (
        fn: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => void,
      ) => Promise<unknown>;
      const bridge: BridgeFn = runInContext(
        `(function(fn) { return new Promise(function(r, j) { fn(r, j); }); })`,
        sandbox,
      );

      const codemode = Object.fromEntries(
        ["get_symbols", "get_historical_price", "get_candlestick_data", "get_latest_price"].map(
          (name) => {
            // Return sandbox-realm Promises via the bridge instead of host-realm
            // async function Promises to prevent prototype chain escape.
            const fn = (arg: unknown) =>
              bridge((resolve, reject) => {
                hostCall(name, arg)
                  .then((result) => resolve(marshalToSandbox(result, sandbox)))
                  .catch((err) =>
                    reject(err instanceof Error ? err.message : String(err)),
                  );
              });
            // Sever the prototype chain so sandbox code cannot reach the host
            // Function constructor via fn.constructor("return process")().
            Object.setPrototypeOf(fn, null);
            return [name, fn];
          },
        ),
      );

      Object.defineProperty(sandbox, "codemode", {
        value: Object.freeze(codemode),
      });

      const trimmed = code.trim();
      const isFnExpr = /^async\s+(?:\(|function\b)/.test(trimmed);
      const wrapped = isFnExpr
        ? `(${trimmed})()`
        : `(async () => { ${trimmed} })()`;

      // runInNewContext timeout only covers synchronous execution.
      // Race with a timer to also catch never-settling promises.
      const vmPromise = runInNewContext(wrapped, sandbox, {
        timeout: timeoutMs,
      });
      let timer: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Execution timed out")),
          timeoutMs,
        );
      });
      const result = await Promise.race([vmPromise, timeoutPromise]).finally(
        () => clearTimeout(timer!),
      );

      return { ok: true, result };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err ?? "Unknown error");
      return { ok: false, error: message };
    }
  }

  return { execute };
}
