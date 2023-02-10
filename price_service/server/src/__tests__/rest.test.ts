import {
  HexString,
  Price,
  PriceFeed,
  PriceFeedMetadata,
} from "@pythnetwork/price-service-sdk";
import express, { Express } from "express";
import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { PriceInfo, PriceStore, VaaCache, VaaConfig } from "../listen";
import { RestAPI } from "../rest";

let priceInfo: PriceStore;
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
      publishTime: 1,
      attestationTime: 2,
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

  priceInfo = {
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

  test("When called with valid ids with leading 0x, returns correct price feed", async () => {
    const ids = [expandTo64Len("abcd"), expandTo64Len("3456")];
    const resp = await request(app)
      .get("/api/latest_price_feeds")
      .query({
        ids: ids.map((id) => "0x" + id), // Add 0x to the queries
      });
    expect(resp.status).toBe(StatusCodes.OK);
    expect(resp.body.length).toBe(2);

    // Please note that the response id is without 0x
    expect(resp.body).toContainEqual(dummyPriceFeed(ids[0]).toJson());
    expect(resp.body).toContainEqual(dummyPriceFeed(ids[1]).toJson());
  });

  test("When called with valid ids and verbose flag set to true, returns correct price feed with verbose information", async () => {
    const ids = [expandTo64Len("abcd"), expandTo64Len("3456")];
    const resp = await request(app)
      .get("/api/latest_price_feeds")
      .query({ ids, verbose: true });
    expect(resp.status).toBe(StatusCodes.OK);
    expect(resp.body.length).toBe(2);
    expect(resp.body).toContainEqual({
      ...priceInfoMap.get(ids[0])!.priceFeed.toJson(),
      metadata: new PriceFeedMetadata({
        attestationTime: priceInfoMap.get(ids[0])!.attestationTime,
        emitterChain: priceInfoMap.get(ids[0])!.emitterChainId,
        receiveTime: priceInfoMap.get(ids[0])!.priceServiceReceiveTime,
        sequenceNumber: priceInfoMap.get(ids[0])!.seqNum,
      }).toJson(),
    });
    expect(resp.body).toContainEqual({
      ...priceInfoMap.get(ids[1])!.priceFeed.toJson(),
      metadata: new PriceFeedMetadata({
        attestationTime: priceInfoMap.get(ids[1])!.attestationTime,
        emitterChain: priceInfoMap.get(ids[1])!.emitterChainId,
        receiveTime: priceInfoMap.get(ids[1])!.priceServiceReceiveTime,
        sequenceNumber: priceInfoMap.get(ids[1])!.seqNum,
      }).toJson(),
    });
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

describe("Latest Vaa Bytes Endpoint", () => {
  test("When called with valid ids, returns vaa bytes as array, merged if necessary", async () => {
    const ids = [
      expandTo64Len("abcd"),
      expandTo64Len("ef01"),
      expandTo64Len("3456"),
    ];
    const resp = await request(app).get("/api/latest_vaas").query({ ids });
    expect(resp.status).toBe(StatusCodes.OK);
    expect(resp.body.length).toBe(2);
    expect(resp.body).toContain(
      Buffer.from("a1b2c3d4", "hex").toString("base64")
    );
    expect(resp.body).toContain(
      Buffer.from("bad01bad", "hex").toString("base64")
    );
  });

  test("When called with valid ids with leading 0x, returns vaa bytes as array, merged if necessary", async () => {
    const ids = [
      expandTo64Len("abcd"),
      expandTo64Len("ef01"),
      expandTo64Len("3456"),
    ];

    const resp = await request(app)
      .get("/api/latest_vaas")
      .query({
        ids: ids.map((id) => "0x" + id), // Add 0x to the queries
      });

    expect(resp.status).toBe(StatusCodes.OK);
    expect(resp.body.length).toBe(2);
    expect(resp.body).toContain(
      Buffer.from("a1b2c3d4", "hex").toString("base64")
    );
    expect(resp.body).toContain(
      Buffer.from("bad01bad", "hex").toString("base64")
    );
  });

  test("When called with some non-existent ids within ids, returns error mentioning non-existent ids", async () => {
    const ids = [
      expandTo64Len("ab01"),
      expandTo64Len("3456"),
      expandTo64Len("effe"),
    ];
    const resp = await request(app).get("/api/latest_vaas").query({ ids });
    expect(resp.status).toBe(StatusCodes.BAD_REQUEST);
    expect(resp.body.message).toContain(ids[0]);
    expect(resp.body.message).not.toContain(ids[1]);
    expect(resp.body.message).toContain(ids[2]);
  });
});

describe("Get VAA endpoint and Get VAA CCIP", () => {
  test("When called with valid id and timestamp in the cache returns the correct answer", async () => {
    const id = expandTo64Len("abcd");
    vaasCache.set(id, 10, "abcd10");
    vaasCache.set(id, 20, "abcd20");
    vaasCache.set(id, 30, "abcd30");

    const resp = await request(app).get("/api/get_vaa").query({
      id,
      publish_time: 16,
    });
    expect(resp.status).toBe(StatusCodes.OK);
    expect(resp.body).toEqual<VaaConfig>({
      vaa: "abcd20",
      publishTime: 20,
    });

    const pubTime16AsHex64Bit = "0000000000000010";
    const ccipResp = await request(app)
      .get("/api/get_vaa_ccip")
      .query({
        data: "0x" + id + pubTime16AsHex64Bit,
      });
    expect(ccipResp.status).toBe(StatusCodes.OK);
    expect(ccipResp.body).toEqual({
      data: "0x" + Buffer.from("abcd20", "base64").toString("hex"),
    });
  });

  test("When called with valid id with leading 0x and timestamp in the cache returns the correct answer", async () => {
    const id = expandTo64Len("abcd");
    vaasCache.set(id, 10, "abcd10");
    vaasCache.set(id, 20, "abcd20");
    vaasCache.set(id, 30, "abcd30");

    const resp = await request(app)
      .get("/api/get_vaa")
      .query({
        id: "0x" + id,
        publish_time: 16,
      });
    expect(resp.status).toBe(StatusCodes.OK);
    expect(resp.body).toEqual<VaaConfig>({
      vaa: "abcd20",
      publishTime: 20,
    });
  });

  test("When called with invalid id returns price id found", async () => {
    // dead does not exist in the ids
    const id = expandTo64Len("dead");

    const resp = await request(app).get("/api/get_vaa").query({
      id,
      publish_time: 16,
    });
    expect(resp.status).toBe(StatusCodes.BAD_REQUEST);
    expect(resp.body.message).toContain(id);

    const pubTime16AsHex64Bit = "0000000000000010";
    const ccipResp = await request(app)
      .get("/api/get_vaa_ccip")
      .query({
        data: "0x" + id + pubTime16AsHex64Bit,
      });
    expect(ccipResp.status).toBe(StatusCodes.BAD_REQUEST);
    expect(ccipResp.body.message).toContain(id);
  });

  test("When called with valid id and timestamp not in the cache without db returns vaa not found", async () => {
    const id = expandTo64Len("abcd");
    vaasCache.set(id, 10, "abcd10");
    vaasCache.set(id, 20, "abcd20");
    vaasCache.set(id, 30, "abcd30");

    const resp = await request(app)
      .get("/api/get_vaa")
      .query({
        id: "0x" + id,
        publish_time: 5,
      });
    expect(resp.status).toBe(StatusCodes.NOT_FOUND);

    const pubTime5AsHex64Bit = "0000000000000005";
    const ccipResp = await request(app)
      .get("/api/get_vaa_ccip")
      .query({
        data: "0x" + id + pubTime5AsHex64Bit,
      });
    // On CCIP we expect bad gateway so the client want to retry other ccip endpoints.
    expect(ccipResp.status).toBe(StatusCodes.BAD_GATEWAY);
  });

  test("When called with valid id and timestamp not in the cache with db returns ok", async () => {
    const dbBackend = express();
    dbBackend.get("/vaa", (req, res) => {
      const priceId = req.query.id;
      const pubTime = Number(req.query.publishTime);
      const cluster = req.query.cluster;

      res.json([
        {
          vaa: `${cluster}${priceId}${pubTime}`,
          publishTime: new Date(pubTime * 1000).toISOString(),
        },
      ]);
    });
    const dbApp = dbBackend.listen({ port: 37777 });

    const apiWithDb = new RestAPI(
      {
        port: 8889,
        dbApiCluster: "pythnet",
        dbApiEndpoint: "http://localhost:37777",
      },
      priceInfo,
      () => true
    );
    const appWithDb = await apiWithDb.createApp();

    const id = expandTo64Len("abcd");
    vaasCache.set(id, 10, "abcd10");
    vaasCache.set(id, 20, "abcd20");
    vaasCache.set(id, 30, "abcd30");

    const resp = await request(appWithDb)
      .get("/api/get_vaa")
      .query({
        id: "0x" + id,
        publish_time: 5,
      });
    expect(resp.status).toBe(StatusCodes.OK);
    expect(resp.body).toEqual<VaaConfig>({
      vaa: `pythnet${id}5`,
      publishTime: 5,
    });

    const pubTime5AsHex64Bit = "0000000000000005";
    const ccipResp = await request(appWithDb)
      .get("/api/get_vaa_ccip")
      .query({
        data: "0x" + id + pubTime5AsHex64Bit,
      });
    expect(ccipResp.status).toBe(StatusCodes.OK);
    expect(ccipResp.body).toEqual({
      data: "0x" + Buffer.from(`pythnet${id}5`, "base64").toString("hex"),
    });

    dbApp.close();
  });

  test(
    "When called with valid id and timestamp not in the cache" +
      "and not in the db returns vaa not found",
    async () => {
      const dbBackend = express();
      dbBackend.get("/vaa", (_req, res) => {
        // Return an empty array when vaa is not there, this is the same
        // behaviour as our api.
        res.json([]);
      });

      const dbApp = dbBackend.listen({ port: 37777 });

      const apiWithDb = new RestAPI(
        {
          port: 8889,
          dbApiCluster: "pythnet",
          dbApiEndpoint: "http://localhost:37777",
        },
        priceInfo,
        () => true
      );
      const appWithDb = await apiWithDb.createApp();

      const id = expandTo64Len("abcd");
      vaasCache.set(id, 10, "abcd10");
      vaasCache.set(id, 20, "abcd20");
      vaasCache.set(id, 30, "abcd30");

      const resp = await request(appWithDb)
        .get("/api/get_vaa")
        .query({
          id: "0x" + id,
          publish_time: 5,
        });
      expect(resp.status).toBe(StatusCodes.NOT_FOUND);

      const pubTime5AsHex64Bit = "0000000000000005";
      const ccipResp = await request(appWithDb)
        .get("/api/get_vaa_ccip")
        .query({
          data: "0x" + id + pubTime5AsHex64Bit,
        });

      // On CCIP we expect bad gateway so the client want to retry other ccip endpoints.
      expect(ccipResp.status).toBe(StatusCodes.BAD_GATEWAY);

      dbApp.close();
    }
  );

  test(
    "When called with valid id and timestamp not in the cache" +
      "and db is not available returns internal server error",
    async () => {
      const apiWithDb = new RestAPI(
        {
          port: 8889,
          dbApiCluster: "pythnet",
          dbApiEndpoint: "http://localhost:37777",
        },
        priceInfo,
        () => true
      );
      const appWithDb = await apiWithDb.createApp();

      const id = expandTo64Len("abcd");
      vaasCache.set(id, 10, "abcd10");
      vaasCache.set(id, 20, "abcd20");
      vaasCache.set(id, 30, "abcd30");

      const resp = await request(appWithDb)
        .get("/api/get_vaa")
        .query({
          id: "0x" + id,
          publish_time: 5,
        });
      expect(resp.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);

      const pubTime5AsHex64Bit = "0000000000000005";
      const ccipResp = await request(appWithDb)
        .get("/api/get_vaa_ccip")
        .query({
          data: "0x" + id + pubTime5AsHex64Bit,
        });
      expect(ccipResp.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    }
  );
});
