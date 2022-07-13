import { HexString, PriceFeed, PriceStatus } from "@pythnetwork/pyth-sdk-js";
import { PriceStore, PriceInfo } from "../listen";
import { WebSocketAPI, ClientMessage } from "../ws";
import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { sleep } from "../helpers";

const port = 2524;

let api: WebSocketAPI;
let server: Server;
let wss: WebSocketServer;

let priceFeeds: PriceFeed[];

function expandTo64Len(id: string): string {
  return id.repeat(64).substring(0, 64);
}

function dummyPriceFeed(id: string): PriceFeed {
  return new PriceFeed({
    conf: "0",
    emaConf: "1",
    emaPrice: "2",
    expo: 4,
    id,
    maxNumPublishers: 7,
    numPublishers: 6,
    prevConf: "8",
    prevPrice: "9",
    prevPublishTime: 10,
    price: "11",
    productId: "def456",
    publishTime: 13,
    status: PriceStatus.Trading,
  });
}

async function waitForSocketState(
  client: WebSocket,
  state: number
): Promise<void> {
  while (client.readyState !== state) {
    await sleep(10);
  }
}

async function waitForMessages(messages: any[], cnt: number): Promise<void> {
  while (messages.length < cnt) {
    await sleep(10);
  }
}

async function createSocketClient(): Promise<[WebSocket, any[]]> {
  const client = new WebSocket(`ws://localhost:${port}/ws`);

  await waitForSocketState(client, client.OPEN);

  const messages: any[] = [];

  client.on("message", (data) => {
    messages.push(JSON.parse(data.toString()));
  });

  return [client, messages];
}

beforeAll(async () => {
  priceFeeds = [
    dummyPriceFeed(expandTo64Len("abcd")),
    dummyPriceFeed(expandTo64Len("ef01")),
    dummyPriceFeed(expandTo64Len("2345")),
    dummyPriceFeed(expandTo64Len("6789")),
  ];

  let priceInfo: PriceStore = {
    getLatestPriceInfo: (_priceFeedId: string) => undefined,
    addUpdateListener: (_callback: (priceFeed: PriceFeed) => any) => undefined,
    getPriceIds: () => new Set(priceFeeds.map((priceFeed) => priceFeed.id)),
  };

  api = new WebSocketAPI(priceInfo);

  server = new Server();
  server.listen(port);

  wss = api.run(server);
});

afterAll(async () => {
  wss.close();
  server.close();
});

describe("Client receives data", () => {
  test("When subscribes with valid ids, returns correct price feed", async () => {
    let [client, serverMessages] = await createSocketClient();

    let message: ClientMessage = {
      ids: [priceFeeds[0].id, priceFeeds[1].id],
      type: "subscribe",
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 1);

    expect(serverMessages[0]).toStrictEqual({
      type: "response",
      status: "success",
    });

    api.dispatchPriceFeedUpdate(priceFeeds[0]);

    await waitForMessages(serverMessages, 2);

    expect(serverMessages[1]).toStrictEqual({
      type: "price_update",
      price_feed: priceFeeds[0].toJson(),
    });

    api.dispatchPriceFeedUpdate(priceFeeds[1]);

    await waitForMessages(serverMessages, 3);

    expect(serverMessages[2]).toStrictEqual({
      type: "price_update",
      price_feed: priceFeeds[1].toJson(),
    });

    client.close();
    await waitForSocketState(client, client.CLOSED);
  });

  test("When subscribes with invalid ids, returns error", async () => {
    let [client, serverMessages] = await createSocketClient();

    let message: ClientMessage = {
      ids: [expandTo64Len("aaaa")],
      type: "subscribe",
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 1);

    expect(serverMessages.length).toBe(1);
    expect(serverMessages[0].type).toBe("response");
    expect(serverMessages[0].status).toBe("error");

    client.close();
    await waitForSocketState(client, client.CLOSED);
  });

  test("When subscribes for Price Feed A, doesn't receive updates for Price Feed B", async () => {
    let [client, serverMessages] = await createSocketClient();

    let message: ClientMessage = {
      ids: [priceFeeds[0].id],
      type: "subscribe",
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 1);

    expect(serverMessages[0]).toStrictEqual({
      type: "response",
      status: "success",
    });

    api.dispatchPriceFeedUpdate(priceFeeds[1]);

    await sleep(100);

    api.dispatchPriceFeedUpdate(priceFeeds[0]);

    await waitForMessages(serverMessages, 2);

    expect(serverMessages[1]).toStrictEqual({
      type: "price_update",
      price_feed: priceFeeds[0].toJson(),
    });

    await sleep(100);
    expect(serverMessages.length).toBe(2);

    client.close();
    await waitForSocketState(client, client.CLOSED);
  });

  test("When subscribes for Price Feed A, receives updated and when unsubscribes stops receiving", async () => {
    let [client, serverMessages] = await createSocketClient();

    let message: ClientMessage = {
      ids: [priceFeeds[0].id],
      type: "subscribe",
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 1);

    expect(serverMessages[0]).toStrictEqual({
      type: "response",
      status: "success",
    });

    api.dispatchPriceFeedUpdate(priceFeeds[0]);

    await waitForMessages(serverMessages, 2);

    expect(serverMessages[1]).toStrictEqual({
      type: "price_update",
      price_feed: priceFeeds[0].toJson(),
    });

    message = {
      ids: [priceFeeds[0].id],
      type: "unsubscribe",
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 3);

    expect(serverMessages[2]).toStrictEqual({
      type: "response",
      status: "success",
    });

    api.dispatchPriceFeedUpdate(priceFeeds[0]);

    await sleep(100);

    expect(serverMessages.length).toBe(3);

    client.close();
    await waitForSocketState(client, client.CLOSED);
  });

  test("Unsubscribe on not subscribed price feed is ok", async () => {
    let [client, serverMessages] = await createSocketClient();

    let message: ClientMessage = {
      ids: [priceFeeds[0].id],
      type: "unsubscribe",
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 1);

    expect(serverMessages[0]).toStrictEqual({
      type: "response",
      status: "success",
    });

    client.close();
    await waitForSocketState(client, client.CLOSED);
  });

  test("Multiple clients with different price feed works", async () => {
    let [client1, serverMessages1] = await createSocketClient();
    let [client2, serverMessages2] = await createSocketClient();

    let message1: ClientMessage = {
      ids: [priceFeeds[0].id],
      type: "subscribe",
    };

    client1.send(JSON.stringify(message1));

    let message2: ClientMessage = {
      ids: [priceFeeds[1].id],
      type: "subscribe",
    };

    client2.send(JSON.stringify(message2));

    await waitForMessages(serverMessages1, 1);
    await waitForMessages(serverMessages2, 1);

    expect(serverMessages1[0]).toStrictEqual({
      type: "response",
      status: "success",
    });

    expect(serverMessages2[0]).toStrictEqual({
      type: "response",
      status: "success",
    });

    api.dispatchPriceFeedUpdate(priceFeeds[0]);
    api.dispatchPriceFeedUpdate(priceFeeds[1]);

    await waitForMessages(serverMessages1, 2);
    await waitForMessages(serverMessages2, 2);

    expect(serverMessages1[1]).toStrictEqual({
      type: "price_update",
      price_feed: priceFeeds[0].toJson(),
    });

    expect(serverMessages2[1]).toStrictEqual({
      type: "price_update",
      price_feed: priceFeeds[1].toJson(),
    });

    client1.close();
    client2.close();

    await waitForSocketState(client1, client1.CLOSED);
    await waitForSocketState(client2, client2.CLOSED);
  });
});
