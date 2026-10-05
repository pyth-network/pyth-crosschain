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

  it("does not let a failing load evict a good entry", async () => {
    const cache = new TtlCache<string>(60_000, 1);
    let aLoads = 0;
    await cache.getOrLoad("a", () => Promise.resolve(`a${++aLoads}`));
    await expect(
      cache.getOrLoad("bad", () => Promise.reject(new Error("401"))),
    ).rejects.toThrow("401");
    const again = await cache.getOrLoad("a", () => Promise.resolve("reload"));
    expect(again).toEqual({ hit: true, value: "a1" });
  });

  it("never evicts a pinned key", async () => {
    const cache = new TtlCache<string>(60_000, 2, {
      isPinned: (k) => k === "public",
    });
    await cache.getOrLoad("public", () => Promise.resolve("catalog"));
    for (const k of ["t1", "t2", "t3", "t4"]) {
      await cache.getOrLoad(k, () => Promise.resolve(k));
    }
    const pub = await cache.getOrLoad("public", () =>
      Promise.resolve("refetched"),
    );
    expect(pub).toEqual({ hit: true, value: "catalog" });
    // Only the newest unpinned key is kept next to the pinned one.
    const t3 = await cache.getOrLoad("t3", () => Promise.resolve("reloaded"));
    expect(t3.hit).toBe(false);
  });

  it("remembers a failure for failureTtlMs when asked to", async () => {
    const cache = new TtlCache<string>(60_000, 10, {
      failureTtlMs: 60_000,
      shouldRememberFailure: (e) => (e as Error).message === "outage",
    });
    let loads = 0;
    const failing = (message: string) => () => {
      loads++;
      return Promise.reject(new Error(message));
    };
    await expect(cache.getOrLoad("k", failing("outage"))).rejects.toThrow();
    await expect(cache.getOrLoad("k", failing("outage"))).rejects.toThrow(
      "outage",
    );
    expect(loads).toBe(1);

    await expect(cache.getOrLoad("j", failing("400"))).rejects.toThrow();
    await expect(cache.getOrLoad("j", failing("400"))).rejects.toThrow();
    expect(loads).toBe(3);
  });

  it("does not remember failures by default", async () => {
    const cache = new TtlCache<string>(60_000, 10);
    await expect(
      cache.getOrLoad("k", () => Promise.reject(new Error("x"))),
    ).rejects.toThrow();
    const ok = await cache.getOrLoad("k", () => Promise.resolve("v"));
    expect(ok).toEqual({ hit: false, value: "v" });
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
