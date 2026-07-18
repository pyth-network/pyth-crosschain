import { createExecutor } from "../../src/codemode/executor.js";

describe("Code Mode executor", () => {
  it("runs code and returns result", async () => {
    const { execute } = createExecutor({ timeoutMs: 5_000 });
    const hostCall = async () => 42;

    const result = await execute("async () => 1 + 1", hostCall);

    expect(result.ok).toBe(true);
    expect(result.ok && result.result).toBe(2);
  });

  it("calls host binding via codemode.* and returns its result", async () => {
    const { execute } = createExecutor({ timeoutMs: 5_000 });
    const hostCall = async (_name: string, arg: unknown) => {
      expect(arg).toEqual({ query: "BTC" });
      return { feeds: [{ symbol: "BTC/USD" }] };
    };

    const result = await execute(
      `async () => await codemode.get_symbols({ query: "BTC" })`,
      hostCall,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.result).toEqual({
      feeds: [{ symbol: "BTC/USD" }],
    });
  });

  it("fetch is not defined in sandbox (no outbound network)", async () => {
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

  it("times out on infinite loop", async () => {
    const { execute } = createExecutor({ timeoutMs: 100 });
    const hostCall = async () => null;

    const result = await execute(
      `async () => { while (true) {} }`,
      hostCall,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeTruthy();
  });

  it("process is not defined in sandbox", async () => {
    const { execute } = createExecutor({ timeoutMs: 5_000 });
    const hostCall = async () => null;

    const result = await execute(
      `async () => { return typeof process; }`,
      hostCall,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.result).toBe("undefined");
  });

  it("require is not defined in sandbox", async () => {
    const { execute } = createExecutor({ timeoutMs: 5_000 });
    const hostCall = async () => null;

    const result = await execute(
      `async () => { return typeof require; }`,
      hostCall,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.result).toBe("undefined");
  });

  it("cannot escape sandbox via host function constructor", async () => {
    const { execute } = createExecutor({ timeoutMs: 5_000 });
    const hostCall = async () => null;

    const result = await execute(
      `async () => codemode.get_symbols.constructor("return typeof process")()`,
      hostCall,
    );

    // With severed prototype, .constructor is undefined and calling it throws
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeTruthy();
  });

  it("cannot escape sandbox via host return value prototype chain", async () => {
    const { execute } = createExecutor({ timeoutMs: 5_000 });
    const hostCall = async () => ({ feeds: [{ symbol: "BTC/USD" }] });

    const result = await execute(
      `async () => {
        const x = await codemode.get_symbols({});
        // If return values are marshaled, x.constructor is Object from
        // the sandbox realm (not host), so this should not give process.
        try {
          const proc = x.constructor.constructor("return typeof process")();
          return proc;
        } catch {
          return "blocked";
        }
      }`,
      hostCall,
    );

    expect(result.ok).toBe(true);
    // Marshaled values have sandbox-realm constructors — typeof process
    // inside the sandbox should be "undefined", or the attempt is blocked.
    expect(result.ok && result.result).not.toBe("object");
  });

  it("cannot escape sandbox via un-awaited Promise prototype chain", async () => {
    const { execute } = createExecutor({ timeoutMs: 5_000 });
    const hostCall = async () => ({ feeds: [] });

    const result = await execute(
      `async () => {
        const p = codemode.get_symbols({});
        // p is a sandbox-realm Promise — its constructor chain should not
        // give access to host Function or process.
        try {
          const F = p.constructor.constructor;
          return F("return typeof process")();
        } catch {
          return "blocked";
        }
      }`,
      hostCall,
    );

    expect(result.ok).toBe(true);
    // Should be "blocked" or "undefined" — never "object"
    expect(result.ok && result.result).not.toBe("object");
  });

  it("times out on never-settling promise", async () => {
    const { execute } = createExecutor({ timeoutMs: 200 });
    const hostCall = async () => null;

    const result = await execute(
      `async () => await new Promise(() => {})`,
      hostCall,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("timed out");
  });
});
