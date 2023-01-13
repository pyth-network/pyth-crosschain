import { HexString, Price, PriceFeed } from "@pythnetwork/pyth-sdk-js";
import { Express } from "express";
import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { PriceInfo, PriceStore, VaaCache } from "../listen";
import { RestAPI } from "../rest";

let app: Express;
let priceInfoMap: Map<string, PriceInfo>;
let vaasCache: VaaCache;

function expandTo64Len(id: string): string {
  return id.repeat(64).substring(0, 64);
}

function dummyPriceFeed(id: string): PriceFeed {
  return new PriceFeed({
    emaPrice: new Price({
      conf: "1",
      expo: 2,
      price: "3",
      publishTime: 4,
    }),
    id,
    price: new Price({
      conf: "5",
      expo: 6,
      price: "7",
      publishTime: 8,
    }),
  });
}

function dummyPriceInfoPair(
  id: HexString,
  seqNum: number,
  vaa: HexString
): [HexString, PriceInfo] {
  return [
    id,
    {
      priceFeed: dummyPriceFeed(id),
      publishTime: 0,
      attestationTime: 0,
      seqNum,
      vaa: Buffer.from(vaa, "hex"),
      emitterChainId: 0,
      priceServiceReceiveTime: 0,
    },
  ];
}

beforeAll(async () => {
  priceInfoMap = new Map<string, PriceInfo>([
    dummyPriceInfoPair(expandTo64Len("abcd"), 1, "a1b2c3d4"),
    dummyPriceInfoPair(expandTo64Len("ef01"), 1, "a1b2c3d4"),
    dummyPriceInfoPair(expandTo64Len("3456"), 2, "bad01bad"),
    dummyPriceInfoPair(expandTo64Len("10101"), 3, "bidbidbid"),
  ]);
  vaasCache = new VaaCache();
  vaasCache.set(
    expandTo64Len("abcd"),
    1,
    Buffer.from("a1b2c3d4", "hex").toString("base64")
  );

  const priceInfo: PriceStore = {
    getLatestPriceInfo: (priceFeedId: string) => {
      return priceInfoMap.get(priceFeedId);
    },
    addUpdateListener: (_callback: (priceInfo: PriceInfo) => any) => undefined,
    getPriceIds: () => new Set(),
    getVaa: (vaasCacheKey: string, publishTime: number) => {
      return vaasCache.get(vaasCacheKey, publishTime);
    },
  };

  const api = new RestAPI({ port: 8889 }, priceInfo, () => true);

  app = await api.createApp();
});

describe("Latest Price Feed Endpoint", () => {
  test("When called with valid ids, returns correct price feed", async () => {
    const ids = [expandTo64Len("abcd"), expandTo64Len("3456")];
    const resp = await request(app)
      .get("/api/latest_price_feeds")
      .query({ ids });
    expect(resp.status).toBe(StatusCodes.OK);
    expect(resp.body.length).toBe(2);
    expect(resp.body).toContainEqual(dummyPriceFeed(ids[0]).toJson());
    expect(resp.body).toContainEqual(dummyPriceFeed(ids[1]).toJson());
  });

  test("When called with valid ids and binary flag set to true, returns correct price feed with binary vaa", async () => {
    const ids = [expandTo64Len("abcd"), expandTo64Len("3456")];
    const resp = await request(app)
      .get("/api/latest_price_feeds")
      .query({ ids, binary: true });
    expect(resp.status).toBe(StatusCodes.OK);
    expect(resp.body.length).toBe(2);
    expect(resp.body).toContainEqual({
      ...priceInfoMap.get(ids[0])!.priceFeed.toJson(),
      vaa: priceInfoMap.get(ids[0])!.vaa.toString("base64"),
    });
    expect(resp.body).toContainEqual({
      ...priceInfoMap.get(ids[1])!.priceFeed.toJson(),
      vaa: priceInfoMap.get(ids[1])!.vaa.toString("base64"),
    });
  });

  test("When called with some non-existent ids within ids, returns error mentioning non-existent ids", async () => {
    const ids = [
      expandTo64Len("ab01"),
      expandTo64Len("3456"),
      expandTo64Len("effe"),
    ];
    const resp = await request(app)
      .get("/api/latest_price_feeds")
      .query({ ids });
    expect(resp.status).toBe(StatusCodes.BAD_REQUEST);
    expect(resp.body.message).toContain(ids[0]);
    expect(resp.body.message).not.toContain(ids[1]);
    expect(resp.body.message).toContain(ids[2]);
  });
});

// describe("Latest Vaa Bytes Endpoint", () => {
//   test("When called with valid ids, returns vaa bytes as array, merged if necessary", async () => {
//     const ids = [
//       expandTo64Len("abcd"),
//       expandTo64Len("ef01"),
//       expandTo64Len("3456"),
//     ];
//     const resp = await request(app).get("/api/latest_vaas").query({ ids });
//     expect(resp.status).toBe(StatusCodes.OK);
//     expect(resp.body.length).toBe(2);
//     expect(resp.body).toContain(
//       Buffer.from("a1b2c3d4", "hex").toString("base64")
//     );
//     expect(resp.body).toContain(
//       Buffer.from("bad01bad", "hex").toString("base64")
//     );
//   });

//   test("When called with some non-existent ids within ids, returns error mentioning non-existent ids", async () => {
//     const ids = [
//       expandTo64Len("ab01"),
//       expandTo64Len("3456"),
//       expandTo64Len("effe"),
//     ];
//     const resp = await request(app).get("/api/latest_vaas").query({ ids });
//     expect(resp.status).toBe(StatusCodes.BAD_REQUEST);
//     expect(resp.body.message).toContain(ids[0]);
//     expect(resp.body.message).not.toContain(ids[1]);
//     expect(resp.body.message).toContain(ids[2]);
//   });
// });

// describe("Get Vaa Endpoint", () => {
//   test("When called with valid id and publish_time, returns vaa string if cached", async () => {
//     const id = expandTo64Len("abcd");
//     const resp = await request(app)
//       .get("/api/get_vaa")
//       .query({ id, publish_time: 1 });
//     expect(resp.status).toBe(StatusCodes.OK);
//     expect(resp.body.length).toBe(8);
//     expect(resp.body).toContain(
//       Buffer.from("a1b2c3d4", "hex").toString("base64")
//     );
//   });
// });
