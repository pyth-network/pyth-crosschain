import { VaaConfig, VaaCache } from "../listen";

describe("VAA Cache works", () => {
  test("Setting and getting works as expected", async () => {
    const cache = new VaaCache();

    expect(cache.get("a", 3)).toBeUndefined();

    cache.set("a", 1, 0, "a-1");

    expect(cache.get("a", 3)).toBeUndefined();

    cache.set("a", 4, 3, "a-2");

    expect(cache.get("a", 3)).toEqual<VaaConfig>({
      publishTime: 4,
      lastAttestedPublishTime: 3,
      vaa: "a-2",
    });

    cache.set("a", 10, 9, "a-3");
    cache.set("a", 10, 10, "a-4");
    cache.set("a", 10, 10, "a-5");
    cache.set("a", 10, 10, "a-6");
    cache.set("a", 11, 11, "a-7");

    // Adding some elements with other keys to make sure
    // they are not stored separately.
    cache.set("b", 3, 2, "b-1");
    cache.set("b", 7, 6, "b-2");
    cache.set("b", 9, 8, "b-3");

    expect(cache.get("a", 3)).toEqual<VaaConfig>({
      publishTime: 4,
      lastAttestedPublishTime: 3,
      vaa: "a-2",
    });
    expect(cache.get("a", 4)).toEqual<VaaConfig>({
      publishTime: 4,
      lastAttestedPublishTime: 3,
      vaa: "a-2",
    });
    expect(cache.get("a", 5)).toEqual<VaaConfig>({
      publishTime: 10,
      lastAttestedPublishTime: 9,
      vaa: "a-3",
    });
    // There are multiple elements at 10, but we prefer to return the one with a lower lastAttestedPublishTime.
    expect(cache.get("a", 10)).toEqual<VaaConfig>({
      publishTime: 10,
      lastAttestedPublishTime: 9,
      vaa: "a-3",
    });
    // If the cache only contains elements where the lastAttestedPublishTime==publishTime, those will be returned.
    // Note that this behavior is undesirable (as this means we can return a noncanonical VAA for a query time);
    // this test simply documents it.
    expect(cache.get("a", 11)).toEqual<VaaConfig>({
      publishTime: 11,
      lastAttestedPublishTime: 11,
      vaa: "a-7",
    });

    expect(cache.get("b", 3)).toEqual<VaaConfig>({
      publishTime: 3,
      lastAttestedPublishTime: 2,
      vaa: "b-1",
    });
    expect(cache.get("b", 4)).toEqual<VaaConfig>({
      publishTime: 7,
      lastAttestedPublishTime: 6,
      vaa: "b-2",
    });

    // When no item item more recent than asked pubTime is asked it should return undefined
    expect(cache.get("a", 12)).toBeUndefined();
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

    cache.set("a", 300, 299, "a-1");
    cache.set("a", 700, 699, "a-2");
    cache.set("a", 900, 899, "a-3");

    expect(cache.get("a", 300)).toEqual<VaaConfig>({
      publishTime: 300,
      lastAttestedPublishTime: 299,
      vaa: "a-1",
    });

    expect(cache.get("a", 500)).toEqual<VaaConfig>({
      publishTime: 700,
      lastAttestedPublishTime: 699,
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

    cache.set("a", 300, 299, "a-1");
    cache.set("a", 700, 699, "a-2");
    cache.set("a", 900, 899, "a-3");

    expect(cache.get("a", 900)).toEqual<VaaConfig>({
      publishTime: 900,
      lastAttestedPublishTime: 899,
      vaa: "a-3",
    });

    // Set time to second 2000. Everything should be evicted from cache now.
    jest.setSystemTime(2000 * 1000);
    jest.advanceTimersToNextTimer();

    expect(cache.get("a", 900)).toBeUndefined();
  });
});
