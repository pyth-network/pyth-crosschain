/**
 * Code Mode executor — runs LLM-generated code in a Node.js vm context.
 *
 * The vm context exposes only: a `codemode` object whose methods call back
 * into the host via `hostCall`. No fetch, require, process, or globals are
 * available — the context is created with an empty sandbox.
 *
 * NOTE: Node's `vm` is NOT a security boundary (same process). This is
 * acceptable because the only callable functions are our own bindings, and
 * the server controls what code is executed. Upgrade to isolated-vm or
 * Cloudflare DynamicWorkerExecutor for stronger isolation if needed.
 */

import { createContext, runInNewContext } from "node:vm";

export type ExecutionResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; logs?: string[] };

export interface ExecutorOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Host callback: (toolName, arg) => Promise<result> */
export type HostBindingFn = (toolName: string, arg: unknown) => Promise<unknown>;

export function createExecutor(options: ExecutorOptions = {}): {
  execute(code: string, hostCall: HostBindingFn): Promise<ExecutionResult>;
} {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function execute(
    code: string,
    hostCall: HostBindingFn,
  ): Promise<ExecutionResult> {
    try {
      const codemode = Object.fromEntries(
        ["get_symbols", "get_historical_price", "get_candlestick_data", "get_latest_price"].map(
          (name) => [name, (arg: unknown) => hostCall(name, arg)],
        ),
      );

      const sandbox = createContext(
        Object.create(null, {
          codemode: { value: Object.freeze(codemode) },
        }),
      );

      const trimmed = code.trim();
      const isFnExpr = /^async\s+(?:\(|function\b)/.test(trimmed);
      const wrapped = isFnExpr
        ? `(${trimmed})()`
        : `(async () => { ${trimmed} })()`;
      const result = await runInNewContext(wrapped, sandbox, {
        timeout: timeoutMs,
      });

      return { ok: true, result };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err ?? "Unknown error");
      return { ok: false, error: message };
    }
  }

  return { execute };
}
