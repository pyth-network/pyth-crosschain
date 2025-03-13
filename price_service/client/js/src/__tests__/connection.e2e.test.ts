import {
  DurationInMs,
  Price,
  PriceFeed,
  PriceFeedMetadata,
  PriceServiceConnection,
} from "../index";

async function sleep(duration: DurationInMs): Promise<void> {
  return new Promise((res) => setTimeout(res, duration));
}

// The endpoint is set to the price service endpoint.
// Please note that if you change it to a mainnet/testnet endpoint
// some tests might fail due to the huge response size of a request.
// i.e. requesting latest price feeds or vaas of all price ids.
const PRICE_SERVICE_ENDPOINT = "http://127.0.0.1:7575";

describe("Test http endpoints", () => {
  test("Get price feed (without verbose/binary) works", async () => {
    const connection = new PriceServiceConnection(PRICE_SERVICE_ENDPOINT);
    const ids = await connection.getPriceFeedIds();
    expect(ids.length).toBeGreaterThan(0);

    const priceFeeds = await connection.getLatestPriceFeeds(ids);
    expect(priceFeeds).toBeDefined();
    expect(priceFeeds!.length).toEqual(ids.length);

    for (const priceFeed of priceFeeds!) {
      expect(priceFeed.id.length).toBe(64); // 32 byte address has size 64 in hex
      expect(priceFeed).toBeInstanceOf(PriceFeed);
      expect(priceFeed.getPriceUnchecked()).toBeInstanceOf(Price);
      expect(priceFeed.getEmaPriceUnchecked()).toBeInstanceOf(Price);
      expect(priceFeed.getMetadata()).toBeUndefined();
      expect(priceFeed.getVAA()).toBeUndefined();
    }
  });

  test("Get price feed with verbose flag works", async () => {
    const connection = new PriceServiceConnection(PRICE_SERVICE_ENDPOINT, {
      priceFeedRequestConfig: { verbose: true },
    });

    const ids = await connection.getPriceFeedIds();
    expect(ids.length).toBeGreaterThan(0);

    const priceFeeds = await connection.getLatestPriceFeeds(ids);
    expect(priceFeeds).toBeDefined();
    expect(priceFeeds!.length).toEqual(ids.length);

    for (const priceFeed of priceFeeds!) {
      expect(priceFeed.getMetadata()).toBeInstanceOf(PriceFeedMetadata);
      expect(priceFeed.getVAA()).toBeUndefined();
    }
  });

  test("Get price feed with binary flag works", async () => {
    const connection = new PriceServiceConnection(PRICE_SERVICE_ENDPOINT, {
      priceFeedRequestConfig: { binary: true },
    });

    const ids = await connection.getPriceFeedIds();
    expect(ids.length).toBeGreaterThan(0);

    const priceFeeds = await connection.getLatestPriceFeeds(ids);
    expect(priceFeeds).toBeDefined();
    expect(priceFeeds!.length).toEqual(ids.length);

    for (const priceFeed of priceFeeds!) {
      expect(priceFeed.getMetadata()).toBeUndefined();
      expect(priceFeed.getVAA()?.length).toBeGreaterThan(0);
    }
  });

  test("Get latest vaa works", async () => {
    const connection = new PriceServiceConnection(PRICE_SERVICE_ENDPOINT, {
      priceFeedRequestConfig: { binary: true },
    });

    const ids = await connection.getPriceFeedIds();
    expect(ids.length).toBeGreaterThan(0);

    const vaas = await connection.getLatestVaas(ids);
    expect(vaas.length).toBeGreaterThan(0);

    for (const vaa of vaas) {
      expect(vaa.length).toBeGreaterThan(0);
    }
  });

  test("Get vaa works", async () => {
    const connection = new PriceServiceConnection(PRICE_SERVICE_ENDPOINT, {
      priceFeedRequestConfig: { binary: true },
    });

    const ids = await connection.getPriceFeedIds();
    expect(ids.length).toBeGreaterThan(0);

    const publishTime10SecAgo = Math.floor(new Date().getTime() / 1000) - 10;
    const [vaa, vaaPublishTime] = await connection.getVaa(
      ids[0],
      publishTime10SecAgo,
    );

    expect(vaa.length).toBeGreaterThan(0);
    expect(vaaPublishTime).toBeGreaterThanOrEqual(publishTime10SecAgo);
  });
});

describe("Test websocket endpoints", () => {
  jest.setTimeout(60 * 1000);

  test.concurrent(
    "websocket subscription works without verbose and binary",
    async () => {
      const connection = new PriceServiceConnection(PRICE_SERVICE_ENDPOINT);

      const ids = await connection.getPriceFeedIds();
      expect(ids.length).toBeGreaterThan(0);

      const counter: Map<string, number> = new Map();
      let totalCounter = 0;

      await connection.subscribePriceFeedUpdates(ids, (priceFeed) => {
        expect(priceFeed.id.length).toBe(64); // 32 byte address has size 64 in hex
        expect(priceFeed.getMetadata()).toBeUndefined();
        expect(priceFeed.getVAA()).toBeUndefined();

        counter.set(priceFeed.id, (counter.get(priceFeed.id) ?? 0) + 1);
        totalCounter += 1;
      });

      // Wait for 30 seconds
      await sleep(30000);
      connection.closeWebSocket();

      expect(totalCounter).toBeGreaterThan(30);

      for (const id of ids) {
        expect(counter.get(id)).toBeDefined();
        // Make sure it receives more than 1 update
        expect(counter.get(id)).toBeGreaterThan(1);
      }
    },
  );

  test.concurrent("websocket subscription works with verbose", async () => {
    const connection = new PriceServiceConnection(PRICE_SERVICE_ENDPOINT, {
      priceFeedRequestConfig: { verbose: true },
    });

    const ids = await connection.getPriceFeedIds();
    expect(ids.length).toBeGreaterThan(0);

    const observedFeeds: Set<string> = new Set();

    await connection.subscribePriceFeedUpdates(ids, (priceFeed) => {
      expect(priceFeed.getMetadata()).toBeInstanceOf(PriceFeedMetadata);
      expect(priceFeed.getVAA()).toBeUndefined();
      observedFeeds.add(priceFeed.id);
    });

    // Wait for 20 seconds
    await sleep(20000);
    await connection.unsubscribePriceFeedUpdates(ids);

    for (const id of ids) {
      expect(observedFeeds.has(id)).toBe(true);
    }
  });

  test.concurrent("websocket subscription works with binary", async () => {
    const connection = new PriceServiceConnection(PRICE_SERVICE_ENDPOINT, {
      priceFeedRequestConfig: { binary: true },
    });

    const ids = await connection.getPriceFeedIds();
    expect(ids.length).toBeGreaterThan(0);

    const observedFeeds: Set<string> = new Set();

    await connection.subscribePriceFeedUpdates(ids, (priceFeed) => {
      expect(priceFeed.getMetadata()).toBeUndefined();
      expect(priceFeed.getVAA()?.length).toBeGreaterThan(0);
      observedFeeds.add(priceFeed.id);
    });

    // Wait for 20 seconds
    await sleep(20000);
    connection.closeWebSocket();

    for (const id of ids) {
      expect(observedFeeds.has(id)).toBe(true);
    }
  });

  // This test only works on Hermes and is not stable because there might
  // be no out of order updates. Hence the last check is commented out.
  test.concurrent(
    "websocket subscription works with allow out of order",
    async () => {
      const connection = new PriceServiceConnection(PRICE_SERVICE_ENDPOINT, {
        priceFeedRequestConfig: { allowOutOfOrder: true, verbose: true },
      });

      const ids = await connection.getPriceFeedIds();
      expect(ids.length).toBeGreaterThan(0);

      const observedSlots: number[] = [];

      await connection.subscribePriceFeedUpdates(ids, (priceFeed) => {
        expect(priceFeed.getMetadata()).toBeDefined();
        expect(priceFeed.getVAA()).toBeUndefined();
        observedSlots.push(priceFeed.getMetadata()!.slot!);
      });

      // Wait for 20 seconds
      await sleep(20000);
      connection.closeWebSocket();

      // Check for out of order slots but don't assert on it since it's not stable
      for (let i = 1; i < observedSlots.length; i++) {
        if (observedSlots[i] < observedSlots[i - 1]) {
          // Out of order slot found, but we don't assert on it
          break;
        }
      }

      // expect(seenOutOfOrder).toBe(true);
    },
  );
});
