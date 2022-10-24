import { HexString, PriceFeed } from "@pythnetwork/pyth-sdk-js";
import { Server } from "http";
import { number } from "joi";
import { WebSocket, WebSocketServer } from "ws";
import { sleep } from "../helpers";
import { PriceInfo, PriceStore } from "../listen";
import { ClientMessage, WebSocketAPI } from "../ws";

const port = 2524;

let api: WebSocketAPI;
let server: Server;
let wss: WebSocketServer;

let priceInfos: PriceInfo[];
let priceMetadata: any;

function expandTo64Len(id: string): string {
  return id.repeat(64).substring(0, 64);
}

function dummyPriceMetadata(
  attestationTime: number,
  emitterChainId: number,
  seqNum: number,
  priceServiceReceiveTime: number
): any {
  return {
    attestation_time: attestationTime,
    emitter_chain: emitterChainId,
    sequence_number: seqNum,
    price_service_receive_time: priceServiceReceiveTime,
  };
}

function dummyPriceInfo(
  id: HexString,
  vaa: HexString,
  dummyPriceMetadataValue: any
): PriceInfo {
  return {
    seqNum: dummyPriceMetadataValue.sequence_number,
    attestationTime: dummyPriceMetadataValue.attestation_time,
    emitterChainId: dummyPriceMetadataValue.emitter_chain,
    priceFeed: dummyPriceFeed(id),
    vaaBytes: Buffer.from(vaa, "hex").toString("binary"),
    priceServiceReceiveTime: dummyPriceMetadataValue.price_service_receive_time,
  };
}

function dummyPriceFeed(id: string): PriceFeed {
  return PriceFeed.fromJson({
    ema_price: {
      conf: "1",
      expo: 2,
      price: "3",
      publish_time: 4,
    },
    id,
    price: {
      conf: "5",
      expo: 6,
      price: "7",
      publish_time: 8,
    },
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
  priceMetadata = dummyPriceMetadata(0, 0, 0, 0);
  priceInfos = [
    dummyPriceInfo(expandTo64Len("abcd"), "a1b2c3d4", priceMetadata),
    dummyPriceInfo(expandTo64Len("ef01"), "a1b2c3d4", priceMetadata),
    dummyPriceInfo(expandTo64Len("2345"), "bad01bad", priceMetadata),
    dummyPriceInfo(expandTo64Len("6789"), "bidbidbid", priceMetadata),
  ];

  const priceInfo: PriceStore = {
    getLatestPriceInfo: (_priceFeedId: string) => undefined,
    addUpdateListener: (_callback: (priceInfo: PriceInfo) => any) => undefined,
    getPriceIds: () => new Set(priceInfos.map((info) => info.priceFeed.id)),
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
  test("When subscribes with valid ids without verbose flag, returns correct price feed", async () => {
    const [client, serverMessages] = await createSocketClient();

    const message: ClientMessage = {
      ids: [priceInfos[0].priceFeed.id, priceInfos[1].priceFeed.id],
      type: "subscribe",
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 1);

    expect(serverMessages[0]).toStrictEqual({
      type: "response",
      status: "success",
    });

    api.dispatchPriceFeedUpdate(priceInfos[0]);

    await waitForMessages(serverMessages, 2);

    expect(serverMessages[1]).toEqual({
      type: "price_update",
      price_feed: priceInfos[0].priceFeed.toJson(),
    });

    api.dispatchPriceFeedUpdate(priceInfos[1]);

    await waitForMessages(serverMessages, 3);

    expect(serverMessages[2]).toEqual({
      type: "price_update",
      price_feed: priceInfos[1].priceFeed.toJson(),
    });

    client.close();
    await waitForSocketState(client, client.CLOSED);
  });

  test("When subscribes with valid ids and verbose flag set to true, returns correct price feed with metadata", async () => {
    const [client, serverMessages] = await createSocketClient();

    const message: ClientMessage = {
      ids: [priceInfos[0].priceFeed.id, priceInfos[1].priceFeed.id],
      type: "subscribe",
      verbose: true,
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 1);

    expect(serverMessages[0]).toStrictEqual({
      type: "response",
      status: "success",
    });

    api.dispatchPriceFeedUpdate(priceInfos[0]);

    await waitForMessages(serverMessages, 2);

    expect(serverMessages[1]).toEqual({
      type: "price_update",
      price_feed: {
        ...priceInfos[0].priceFeed.toJson(),
        metadata: priceMetadata,
      },
    });

    api.dispatchPriceFeedUpdate(priceInfos[1]);

    await waitForMessages(serverMessages, 3);

    expect(serverMessages[2]).toEqual({
      type: "price_update",
      price_feed: {
        ...priceInfos[1].priceFeed.toJson(),
        metadata: priceMetadata,
      },
    });

    client.close();
    await waitForSocketState(client, client.CLOSED);
  });

  test("When subscribes with valid ids and verbose flag set to false, returns correct price feed without metadata", async () => {
    const [client, serverMessages] = await createSocketClient();

    const message: ClientMessage = {
      ids: [priceInfos[0].priceFeed.id, priceInfos[1].priceFeed.id],
      type: "subscribe",
      verbose: false,
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 1);

    expect(serverMessages[0]).toStrictEqual({
      type: "response",
      status: "success",
    });

    api.dispatchPriceFeedUpdate(priceInfos[0]);

    await waitForMessages(serverMessages, 2);

    expect(serverMessages[1]).toEqual({
      type: "price_update",
      price_feed: priceInfos[0].priceFeed.toJson(),
    });

    api.dispatchPriceFeedUpdate(priceInfos[1]);

    await waitForMessages(serverMessages, 3);

    expect(serverMessages[2]).toEqual({
      type: "price_update",
      price_feed: priceInfos[1].priceFeed.toJson(),
    });

    client.close();
    await waitForSocketState(client, client.CLOSED);
  });

  test("When subscribes with invalid ids, returns error", async () => {
    const [client, serverMessages] = await createSocketClient();

    const message: ClientMessage = {
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
    const [client, serverMessages] = await createSocketClient();

    const message: ClientMessage = {
      ids: [priceInfos[0].priceFeed.id],
      type: "subscribe",
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 1);

    expect(serverMessages[0]).toStrictEqual({
      type: "response",
      status: "success",
    });

    api.dispatchPriceFeedUpdate(priceInfos[1]);

    await sleep(100);

    api.dispatchPriceFeedUpdate(priceInfos[0]);

    await waitForMessages(serverMessages, 2);

    expect(serverMessages[1]).toEqual({
      type: "price_update",
      price_feed: priceInfos[0].priceFeed.toJson(),
    });

    await sleep(100);
    expect(serverMessages.length).toBe(2);

    client.close();
    await waitForSocketState(client, client.CLOSED);
  });

  test("When subscribes for Price Feed A, receives updated and when unsubscribes stops receiving", async () => {
    const [client, serverMessages] = await createSocketClient();

    let message: ClientMessage = {
      ids: [priceInfos[0].priceFeed.id],
      type: "subscribe",
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 1);

    expect(serverMessages[0]).toStrictEqual({
      type: "response",
      status: "success",
    });

    api.dispatchPriceFeedUpdate(priceInfos[0]);

    await waitForMessages(serverMessages, 2);

    expect(serverMessages[1]).toEqual({
      type: "price_update",
      price_feed: priceInfos[0].priceFeed.toJson(),
    });

    message = {
      ids: [priceInfos[0].priceFeed.id],
      type: "unsubscribe",
    };

    client.send(JSON.stringify(message));

    await waitForMessages(serverMessages, 3);

    expect(serverMessages[2]).toStrictEqual({
      type: "response",
      status: "success",
    });

    api.dispatchPriceFeedUpdate(priceInfos[0]);

    await sleep(100);

    expect(serverMessages.length).toBe(3);

    client.close();
    await waitForSocketState(client, client.CLOSED);
  });

  test("Unsubscribe on not subscribed price feed is ok", async () => {
    const [client, serverMessages] = await createSocketClient();

    const message: ClientMessage = {
      ids: [priceInfos[0].priceFeed.id],
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
    const [client1, serverMessages1] = await createSocketClient();
    const [client2, serverMessages2] = await createSocketClient();

    const message1: ClientMessage = {
      ids: [priceInfos[0].priceFeed.id],
      type: "subscribe",
    };

    client1.send(JSON.stringify(message1));

    const message2: ClientMessage = {
      ids: [priceInfos[1].priceFeed.id],
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

    api.dispatchPriceFeedUpdate(priceInfos[0]);
    api.dispatchPriceFeedUpdate(priceInfos[1]);

    await waitForMessages(serverMessages1, 2);
    await waitForMessages(serverMessages2, 2);

    expect(serverMessages1[1]).toEqual({
      type: "price_update",
      price_feed: priceInfos[0].priceFeed.toJson(),
    });

    expect(serverMessages2[1]).toEqual({
      type: "price_update",
      price_feed: priceInfos[1].priceFeed.toJson(),
    });

    client1.close();
    client2.close();

    await waitForSocketState(client1, client1.CLOSED);
    await waitForSocketState(client2, client2.CLOSED);
  });
});
