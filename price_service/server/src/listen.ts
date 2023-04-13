import {
  createSpyRPCServiceClient,
  subscribeSignedVAA,
} from "@certusone/wormhole-spydk";

import { ChainId, uint8ArrayToHex, parseVaa } from "@certusone/wormhole-sdk";

import {
  FilterEntry,
  SubscribeSignedVAAResponse,
} from "@certusone/wormhole-spydk/lib/cjs/proto/spy/v1/spy";
import { ClientReadableStream } from "@grpc/grpc-js";
import {
  getBatchSummary,
  parseBatchPriceAttestation,
  priceAttestationToPriceFeed,
  PriceAttestation,
} from "@pythnetwork/wormhole-attester-sdk";
import { HexString, PriceFeed } from "@pythnetwork/price-service-sdk";
import LRUCache from "lru-cache";
import { DurationInSec, sleep, TimestampInSec } from "./helpers";
import { logger } from "./logging";
import { PromClient } from "./promClient";

export type PriceInfo = {
  vaa: Buffer;
  seqNum: number;
  publishTime: TimestampInSec;
  attestationTime: TimestampInSec;
  priceFeed: PriceFeed;
  emitterChainId: number;
  priceServiceReceiveTime: number;
};

export function createPriceInfo(
  priceAttestation: PriceAttestation,
  vaa: Buffer,
  sequence: string,
  emitterChain: number
): PriceInfo {
  const priceFeed = priceAttestationToPriceFeed(priceAttestation);
  return {
    seqNum: Number(sequence),
    vaa,
    publishTime: priceAttestation.publishTime,
    attestationTime: priceAttestation.attestationTime,
    priceFeed,
    emitterChainId: emitterChain,
    priceServiceReceiveTime: Math.floor(new Date().getTime() / 1000),
  };
}

export interface PriceStore {
  getPriceIds(): Set<HexString>;
  getLatestPriceInfo(priceFeedId: HexString): PriceInfo | undefined;
  addUpdateListener(callback: (priceInfo: PriceInfo) => any): void;
  getVaa(priceFeedId: string, publishTime: number): VaaConfig | undefined;
}

type ListenerReadinessConfig = {
  spySyncTimeSeconds: number;
  numLoadedSymbols: number;
};

type ListenerConfig = {
  spyServiceHost: string;
  filtersRaw?: string;
  readiness: ListenerReadinessConfig;
  webApiEndpoint?: string;
  webApiCluster?: string;
  cacheCleanupLoopInterval?: DurationInSec;
  cacheTtl?: DurationInSec;
};

type VaaKey = string;

export type VaaConfig = {
  publishTime: number;
  vaa: string;
};

export class VaaCache {
  private cache: Map<string, VaaConfig[]>;
  private ttl: DurationInSec;
  private cacheCleanupLoopInterval: DurationInSec;

  constructor(
    ttl: DurationInSec = 300,
    cacheCleanupLoopInterval: DurationInSec = 60
  ) {
    this.cache = new Map();
    this.ttl = ttl;
    this.cacheCleanupLoopInterval = cacheCleanupLoopInterval;
  }

  set(key: VaaKey, publishTime: TimestampInSec, vaa: string): void {
    if (this.cache.has(key)) {
      this.cache.get(key)!.push({ publishTime, vaa });
    } else {
      this.cache.set(key, [{ publishTime, vaa }]);
    }
  }

  get(key: VaaKey, publishTime: TimestampInSec): VaaConfig | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    } else {
      const vaaConf = this.find(this.cache.get(key)!, publishTime);
      return vaaConf;
    }
  }

  private find(
    arr: VaaConfig[],
    publishTime: TimestampInSec
  ): VaaConfig | undefined {
    // If the publishTime is less than the first element we are
    // not sure that this VAA is actually the first VAA after that
    // time.
    if (arr.length === 0 || publishTime < arr[0].publishTime) {
      return undefined;
    }
    let left = 0;
    let right = arr.length - 1;
    let nextLargest = -1;

    while (left <= right) {
      const middle = Math.floor((left + right) / 2);
      if (arr[middle].publishTime === publishTime) {
        return arr[middle];
      } else if (arr[middle].publishTime < publishTime) {
        left = middle + 1;
      } else {
        nextLargest = middle;
        right = middle - 1;
      }
    }

    return nextLargest !== -1 ? arr[nextLargest] : undefined;
  }

  async removeExpiredValues() {
    const now = Math.floor(Date.now() / 1000);
    for (const key of this.cache.keys()) {
      this.cache.set(
        key,
        this.cache
          .get(key)!
          .filter((vaaConf) => now - vaaConf.publishTime < this.ttl)
      );
    }
  }

  runRemoveExpiredValuesLoop() {
    setInterval(
      this.removeExpiredValues.bind(this),
      this.cacheCleanupLoopInterval * 1000
    );
  }
}

export class Listener implements PriceStore {
  // Mapping of Price Feed Id to Vaa
  private priceFeedVaaMap = new Map<string, PriceInfo>();
  private promClient: PromClient | undefined;
  private spyServiceHost: string;
  private filters: FilterEntry[] = [];
  private ignorePricesOlderThanSecs: number;
  private spyConnectionTime: TimestampInSec | undefined;
  private readinessConfig: ListenerReadinessConfig;
  private updateCallbacks: ((priceInfo: PriceInfo) => any)[];
  private observedVaas: LRUCache<VaaKey, boolean>;
  private vaasCache: VaaCache;

  constructor(config: ListenerConfig, promClient?: PromClient) {
    this.promClient = promClient;
    this.spyServiceHost = config.spyServiceHost;
    this.loadFilters(config.filtersRaw);
    // Don't store any prices received from wormhole that are over 5 minutes old.
    this.ignorePricesOlderThanSecs = 5 * 60;
    this.readinessConfig = config.readiness;
    this.updateCallbacks = [];
    this.observedVaas = new LRUCache({
      max: 100000, // At most 100000 items
      ttl: 6 * 60 * 1000, // 6 minutes which is longer than ignorePricesOlderThanSecs
    });
    this.vaasCache = new VaaCache(
      config.cacheTtl,
      config.cacheCleanupLoopInterval
    );
  }

  private loadFilters(filtersRaw?: string) {
    if (!filtersRaw) {
      logger.info("No filters provided. Will process all signed VAAs");
      return;
    }

    const parsedJsonFilters = JSON.parse(filtersRaw);

    for (const filter of parsedJsonFilters) {
      const myChainId = parseInt(filter.chain_id, 10) as ChainId;
      const myEmitterAddress = filter.emitter_address;
      const myEmitterFilter: FilterEntry = {
        emitterFilter: {
          chainId: myChainId,
          emitterAddress: myEmitterAddress,
        },
      };
      logger.info(
        "adding filter: chainId: [" +
          myEmitterFilter.emitterFilter!.chainId +
          "], emitterAddress: [" +
          myEmitterFilter.emitterFilter!.emitterAddress +
          "]"
      );
      this.filters.push(myEmitterFilter);
    }

    logger.info("loaded " + this.filters.length + " filters");
  }

  async run() {
    logger.info(
      "pyth_relay starting up, will listen for signed VAAs from " +
        this.spyServiceHost
    );

    this.vaasCache.runRemoveExpiredValuesLoop();

    while (true) {
      let stream: ClientReadableStream<SubscribeSignedVAAResponse> | undefined;
      try {
        const client = createSpyRPCServiceClient(this.spyServiceHost);
        stream = await subscribeSignedVAA(client, { filters: this.filters });

        stream!.on("data", ({ vaaBytes }: { vaaBytes: Buffer }) => {
          this.processVaa(vaaBytes);
        });

        this.spyConnectionTime = this.currentTimeInSeconds();

        let connected = true;
        stream!.on("error", (err: any) => {
          logger.error("spy service returned an error: %o", err);
          connected = false;
        });

        stream!.on("close", () => {
          logger.error("spy service closed the connection!");
          connected = false;
        });

        logger.info("connected to spy service, listening for messages");

        while (connected) {
          await sleep(1000);
        }
      } catch (e) {
        logger.error("spy service threw an exception: %o", e);
      }

      if (stream) {
        stream.destroy();
      }
      this.spyConnectionTime = undefined;

      await sleep(1000);
      logger.info("attempting to reconnect to the spy service");
    }
  }

  isNewPriceInfo(
    cachedInfo: PriceInfo | undefined,
    observedInfo: PriceInfo
  ): boolean {
    if (cachedInfo === undefined) {
      return true;
    }

    if (cachedInfo.attestationTime < observedInfo.attestationTime) {
      return true;
    }

    if (
      cachedInfo.attestationTime === observedInfo.attestationTime &&
      cachedInfo.seqNum < observedInfo.seqNum
    ) {
      return true;
    }

    return false;
  }

  async processVaa(vaa: Buffer) {
    const parsedVaa = parseVaa(vaa);

    const vaaEmitterAddressHex = Buffer.from(parsedVaa.emitterAddress).toString(
      "hex"
    );

    const observedVaasKey: VaaKey = `${parsedVaa.emitterChain}#${vaaEmitterAddressHex}#${parsedVaa.sequence}`;

    if (this.observedVaas.has(observedVaasKey)) {
      return;
    }

    let batchAttestation;

    try {
      batchAttestation = parseBatchPriceAttestation(
        Buffer.from(parsedVaa.payload)
      );
    } catch (e: any) {
      logger.error(e, e.stack);
      logger.error("Parsing failed. Dropping vaa: %o", parsedVaa);
      return;
    }

    if (batchAttestation.priceAttestations.length === 0) {
      return;
    }

    // Attestation time is the same in all feeds in the batch.
    // Return early if an attestation is old to exclude it from
    // the counter metric.
    if (
      batchAttestation.priceAttestations[0].attestationTime <
      this.currentTimeInSeconds() - this.ignorePricesOlderThanSecs
    ) {
      return;
    }

    // There is no `await` clause to release the current thread since the previous check
    // but this is here to ensure this is correct as the code evolves.
    if (this.observedVaas.has(observedVaasKey)) {
      return;
    } else {
      this.observedVaas.set(observedVaasKey, true);
      this.promClient?.incReceivedVaa();
    }

    for (const priceAttestation of batchAttestation.priceAttestations) {
      const key = priceAttestation.priceId;

      const priceInfo = createPriceInfo(
        priceAttestation,
        vaa,
        parsedVaa.sequence,
        parsedVaa.emitterChain
      );
      const cachedPriceInfo = this.priceFeedVaaMap.get(key);

      if (this.isNewPriceInfo(cachedPriceInfo, priceInfo)) {
        this.vaasCache.set(
          priceInfo.priceFeed.id,
          priceInfo.publishTime,
          priceInfo.vaa.toString("base64")
        );
        this.priceFeedVaaMap.set(key, priceInfo);

        if (cachedPriceInfo !== undefined) {
          this.promClient?.addPriceUpdatesAttestationTimeGap(
            priceAttestation.attestationTime - cachedPriceInfo.attestationTime
          );
          this.promClient?.addPriceUpdatesPublishTimeGap(
            priceAttestation.publishTime - cachedPriceInfo.publishTime
          );
        }

        for (const callback of this.updateCallbacks) {
          callback(priceInfo);
        }
      }
    }

    logger.info(
      "Parsed a new Batch Price Attestation: [" +
        parsedVaa.emitterChain +
        ":" +
        uint8ArrayToHex(parsedVaa.emitterAddress) +
        "], seqNum: " +
        parsedVaa.sequence +
        ", Batch Summary: " +
        getBatchSummary(batchAttestation)
    );
  }

  getVaa(priceFeedId: string, publishTime: number): VaaConfig | undefined {
    return this.vaasCache.get(priceFeedId, publishTime);
  }

  getLatestPriceInfo(priceFeedId: string): PriceInfo | undefined {
    return this.priceFeedVaaMap.get(priceFeedId);
  }

  addUpdateListener(callback: (priceInfo: PriceInfo) => any) {
    this.updateCallbacks.push(callback);
  }

  getPriceIds(): Set<HexString> {
    return new Set(this.priceFeedVaaMap.keys());
  }

  isReady(): boolean {
    const currentTime: TimestampInSec = Math.floor(Date.now() / 1000);
    if (
      this.spyConnectionTime === undefined ||
      currentTime <
        this.spyConnectionTime + this.readinessConfig.spySyncTimeSeconds
    ) {
      return false;
    }
    if (this.priceFeedVaaMap.size < this.readinessConfig.numLoadedSymbols) {
      return false;
    }

    return true;
  }

  private currentTimeInSeconds(): number {
    return new Date().getTime() / 1000;
  }
}
