import {
  EndpointPool,
  withEndpointFailover,
} from "../src/injective/endpoint-pool.js";

const silentLogger = {
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  silent: () => undefined,
  level: "silent",
  child: () => silentLogger,
} as unknown as Parameters<typeof EndpointPool>[1] extends never
  ? never
  : ConstructorParameters<typeof EndpointPool>[1];

describe("EndpointPool", () => {
  it("rejects an empty endpoint list", () => {
    expect(() => new EndpointPool([], silentLogger)).toThrow(
      /at least one endpoint/,
    );
  });

  it("returns the first endpoint by default", () => {
    const pool = new EndpointPool(["a", "b", "c"], silentLogger);
    expect(pool.current()).toBe("a");
    expect(pool.size()).toBe(3);
  });

  it("rotates round-robin and wraps past the end", () => {
    const pool = new EndpointPool(["a", "b", "c"], silentLogger);
    pool.rotate(new Error("first failure"));
    expect(pool.current()).toBe("b");
    pool.rotate(new Error("second failure"));
    expect(pool.current()).toBe("c");
    pool.rotate(new Error("wrap"));
    expect(pool.current()).toBe("a");
  });

  it("treats rotate() as a no-op for a single-endpoint pool", () => {
    const pool = new EndpointPool(["only"], silentLogger);
    expect(pool.current()).toBe("only");
    pool.rotate(new Error("transient"));
    expect(pool.current()).toBe("only");
  });
});

describe("withEndpointFailover", () => {
  it("returns the first successful result without rotating", async () => {
    const pool = new EndpointPool(["a", "b", "c"], silentLogger);
    const seen: string[] = [];
    const result = await withEndpointFailover(pool, (endpoint) => {
      seen.push(endpoint);
      return Promise.resolve(endpoint.toUpperCase());
    });
    expect(result).toBe("A");
    expect(seen).toEqual(["a"]);
    expect(pool.current()).toBe("a");
  });

  it("rotates to the next endpoint on failure and returns its result", async () => {
    const pool = new EndpointPool(["a", "b", "c"], silentLogger);
    const seen: string[] = [];
    const result = await withEndpointFailover(pool, (endpoint) => {
      seen.push(endpoint);
      if (endpoint === "a") return Promise.reject(new Error("a down"));
      return Promise.resolve(endpoint);
    });
    expect(result).toBe("b");
    expect(seen).toEqual(["a", "b"]);
    expect(pool.current()).toBe("b");
  });

  it("walks every endpoint at most once before re-throwing", async () => {
    const pool = new EndpointPool(["a", "b", "c"], silentLogger);
    const attempts: string[] = [];
    await expect(
      withEndpointFailover(pool, (endpoint) => {
        attempts.push(endpoint);
        return Promise.reject(new Error(`${endpoint} down`));
      }),
    ).rejects.toThrow(/c down/);
    expect(attempts).toEqual(["a", "b", "c"]);
  });

  it("starts from wherever the pool's cursor currently is", async () => {
    const pool = new EndpointPool(["a", "b", "c"], silentLogger);
    pool.rotate(new Error("prior cycle"));
    const attempts: string[] = [];
    await withEndpointFailover(pool, (endpoint) => {
      attempts.push(endpoint);
      return Promise.resolve(endpoint);
    });
    expect(attempts).toEqual(["b"]);
  });
});
