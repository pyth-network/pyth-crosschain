/**
 * Code Mode executor — runs LLM-generated code in an isolated V8 sandbox.
 *
 * Deny-by-default outbound policy:
 * - No fetch(), no XMLHttpRequest, no WebSocket — isolate has no network APIs
 * - No require(), no import — no module loading
 * - No process, no global — no env var leaks
 * - Only codemode.* calls are allowed via host callback; those route through approved bindings
 *
 * The isolate receives only: __hostCall (callback) and a bootstrap that defines codemode.
 * User code cannot bypass this to access external networks.
 */

import ivm from "isolated-vm";

export type ExecutionResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; logs?: string[] };

export interface ExecutorOptions {
  timeoutMs?: number;
  memoryLimitMb?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MEMORY_MB = 128;

/** Host callback: (toolName, arg) => Promise<result> */
export type HostBindingFn = (toolName: string, arg: unknown) => Promise<unknown>;

const BOOTSTRAP = `
const codemode = {
  get_symbols: (arg) => __hostCall('get_symbols', arg),
  get_historical_price: (arg) => __hostCall('get_historical_price', arg),
  get_candlestick_data: (arg) => __hostCall('get_candlestick_data', arg),
  get_latest_price: (arg) => __hostCall('get_latest_price', arg),
};
`.trim();

export function createExecutor(options: ExecutorOptions = {}): {
  execute(code: string, hostCall: HostBindingFn): Promise<ExecutionResult>;
} {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const memoryLimitMb = options.memoryLimitMb ?? DEFAULT_MEMORY_MB;

  async function execute(
    code: string,
    hostCall: HostBindingFn,
  ): Promise<ExecutionResult> {
    const isolate = new ivm.Isolate({ memoryLimit: memoryLimitMb });
    let disposed = false;
    const dispose = () => {
      if (!disposed) {
        disposed = true;
        isolate.dispose();
      }
    };

    try {
      const ctx = await isolate.createContext();

      const hostCallCallback = new ivm.Callback(
        async (name: string, arg: unknown): Promise<unknown> => {
          return hostCall(name, arg);
        },
        { async: true },
      );
      ctx.global.set("__hostCall", hostCallCallback);

      await ctx.eval(BOOTSTRAP, { timeout: 5_000 });

      const wrapped = `(async () => { ${code} })()`;
      const resultRef = await ctx.eval(wrapped, {
        copy: true,
        timeout: timeoutMs,
      });

      dispose();
      return { ok: true, result: resultRef };
    } catch (err) {
      dispose();
      const message =
        err instanceof Error ? err.message : String(err ?? "Unknown error");
      return { ok: false, error: message };
    }
  }

  return { execute };
}
