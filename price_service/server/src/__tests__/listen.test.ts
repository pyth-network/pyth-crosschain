import { VaaConfig, VaaCache } from "../listen";

describe("VAA Cache works", () => {
  test("Setting and getting works as expected", async () => {
    const cache = new VaaCache();

    expect(cache.get("a", 3)).toBeUndefined();

    cache.set("a", 1, "a-1");

    expect(cache.get("a", 3)).toBeUndefined();

    cache.set("a", 4, "a-2");

    expect(cache.get("a", 3)).toEqual<VaaConfig>({
      publishTime: 4,
      vaa: "a-2",
    });

    cache.set("a", 10, "a-3");

    // Adding some elements with other keys to make sure
    // they are not stored separately.
    cache.set("b", 3, "b-1");
    cache.set("b", 7, "b-2");
    cache.set("b", 9, "b-3");

    expect(cache.get("a", 3)).toEqual<VaaConfig>({
      publishTime: 4,
      vaa: "a-2",
    });
    expect(cache.get("a", 4)).toEqual<VaaConfig>({
      publishTime: 4,
      vaa: "a-2",
    });
    expect(cache.get("a", 5)).toEqual<VaaConfig>({
      publishTime: 10,
      vaa: "a-3",
    });
    expect(cache.get("a", 10)).toEqual<VaaConfig>({
      publishTime: 10,
      vaa: "a-3",
    });

    expect(cache.get("b", 3)).toEqual<VaaConfig>({
      publishTime: 3,
      vaa: "b-1",
    });
    expect(cache.get("b", 4)).toEqual<VaaConfig>({
      publishTime: 7,
      vaa: "b-2",
    });

    // When no item item more recent than asked pubTime is asked it should return undefined
    expect(cache.get("a", 11)).toBeUndefined();
    expect(cache.get("b", 10)).toBeUndefined();

    // When the asked pubTime is less than the first existing pubTime we are not sure that
    // this is the first vaa after that time, so we should return undefined.
    expect(cache.get("a", 0)).toBeUndefined();
    expect(cache.get("b", 1)).toBeUndefined();
    expect(cache.get("b", 2)).toBeUndefined();
  });

  test("removeExpiredValues clears the old values", async () => {
    jest.useFakeTimers();

    // TTL of 500 seconds for the cache
    const cache = new VaaCache(500);

    cache.set("a", 300, "a-1");
    cache.set("a", 700, "a-2");
    cache.set("a", 900, "a-3");

    expect(cache.get("a", 300)).toEqual<VaaConfig>({
      publishTime: 300,
      vaa: "a-1",
    });

    expect(cache.get("a", 500)).toEqual<VaaConfig>({
      publishTime: 700,
      vaa: "a-2",
    });

    // Set time to second 1000
    jest.setSystemTime(1000 * 1000);

    cache.removeExpiredValues();

    expect(cache.get("a", 300)).toBeUndefined();
    expect(cache.get("a", 500)).toBeUndefined();
  });

  test("the cache clean loop works", async () => {
    jest.useFakeTimers();

    // TTL of 500 seconds for the cache and cleanup of every 100 seconds
    const cache = new VaaCache(500, 100);
    cache.runRemoveExpiredValuesLoop();

    cache.set("a", 300, "a-1");
    cache.set("a", 700, "a-2");
    cache.set("a", 900, "a-3");

    expect(cache.get("a", 900)).toEqual<VaaConfig>({
      publishTime: 900,
      vaa: "a-3",
    });

    // Set time to second 2000. Everything should be evicted from cache now.
    jest.setSystemTime(2000 * 1000);
    jest.advanceTimersToNextTimer();

    expect(cache.get("a", 900)).toBeUndefined();
  });
});
