import { createExecutor } from "../../src/codemode/executor.js";

describe("Code Mode executor", () => {
  it("runs code and returns result", async () => {
    const { execute } = createExecutor({ timeoutMs: 5_000 });
    const hostCall = async () => 42;

    const result = await execute("async () => 1 + 1", hostCall);

    expect(result.ok).toBe(true);
    expect(result.ok && result.result).toBe(2);
  });

  it("calls host binding and returns its result", async () => {
    const { execute } = createExecutor({ timeoutMs: 5_000 });
    const hostCall = async (_name: string, arg: unknown) => {
      expect(arg).toEqual({ query: "BTC" });
      return { feeds: [{ symbol: "BTC/USD" }] };
    };

    const result = await execute(
      `async () => await __hostCall('get_symbols', { query: "BTC" })`,
      hostCall,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.result).toEqual({
      feeds: [{ symbol: "BTC/USD" }],
    });
  });

  it("in isolate, fetch is not defined (no outbound network)", async () => {
    const { execute } = createExecutor({ timeoutMs: 5_000 });
    const hostCall = async () => null;

    const result = await execute(
      `async () => { return typeof fetch; }`,
      hostCall,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.result).toBe("undefined");
  });

  it("returns error on invalid code", async () => {
    const { execute } = createExecutor({ timeoutMs: 5_000 });
    const hostCall = async () => null;

    const result = await execute(
      `async () => { throw new Error("oops"); }`,
      hostCall,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("oops");
  });
});
