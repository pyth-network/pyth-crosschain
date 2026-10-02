import { symbolsCacheKey, TtlCache } from "../../src/clients/symbols-store.js";

describe("TtlCache", () => {
  it("shares one in-flight load between concurrent callers", async () => {
    const cache = new TtlCache<number>(60_000, 10);
    let loads = 0;
    const load = async () => {
      loads++;
      await new Promise((r) => setTimeout(r, 10));
      return 42;
    };
    const [a, b] = await Promise.all([
      cache.getOrLoad("k", load),
      cache.getOrLoad("k", load),
    ]);
    expect(loads).toBe(1);
    expect(a.value).toBe(42);
    expect(b.value).toBe(42);
    expect(a.hit).toBe(false);
    expect(b.hit).toBe(true);
  });

  it("reloads after the TTL expires", async () => {
    const cache = new TtlCache<number>(5, 10);
    let loads = 0;
    const load = () => Promise.resolve(++loads);
    await cache.getOrLoad("k", load);
    await new Promise((r) => setTimeout(r, 15));
    const again = await cache.getOrLoad("k", load);
    expect(again.value).toBe(2);
    expect(again.hit).toBe(false);
  });

  it("evicts the least recently used entry beyond the cap", async () => {
    const cache = new TtlCache<string>(60_000, 2);
    const loads: string[] = [];
    const load = (k: string) => () => {
      loads.push(k);
      return Promise.resolve(k);
    };
    await cache.getOrLoad("a", load("a"));
    await cache.getOrLoad("b", load("b"));
    await cache.getOrLoad("a", load("a")); // a is now most recent
    await cache.getOrLoad("c", load("c")); // evicts b
    await cache.getOrLoad("a", load("a"));
    await cache.getOrLoad("b", load("b"));
    expect(loads).toEqual(["a", "b", "c", "b"]);
  });
});

describe("symbolsCacheKey", () => {
  it("never contains the raw token", () => {
    const key = symbolsCacheKey("https://x", "secret-token", "all");
    expect(key).not.toContain("secret-token");
  });

  it("separates anonymous and authenticated callers", () => {
    expect(symbolsCacheKey("https://x", undefined, "all")).not.toBe(
      symbolsCacheKey("https://x", "t", "all"),
    );
  });
});
