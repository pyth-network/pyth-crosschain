import { ChainId, uint8ArrayToHex } from "@certusone/wormhole-sdk";

import {
  createSpyRPCServiceClient,
  subscribeSignedVAA,
} from "@certusone/wormhole-spydk";

import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import { createHash } from "crypto";

import {
  getBatchSummary,
  parseBatchPriceAttestation,
  priceAttestationToPriceFeed,
} from "@pythnetwork/p2w-sdk-js";
import {
  FilterEntry,
  SubscribeSignedVAAResponse,
} from "@certusone/wormhole-spydk/lib/cjs/proto/spy/v1/spy";
import { ClientReadableStream } from "@grpc/grpc-js";
import { HexString, PriceFeed } from "@pythnetwork/pyth-sdk-js";
import { sleep, TimestampInSec } from "./helpers";
import { logger } from "./logging";
import { PromClient } from "./promClient";
import LRUCache from "lru-cache";

export type PriceInfo = {
  vaa: Buffer;
  seqNum: number;
  publishTime: TimestampInSec;
  attestationTime: TimestampInSec;
  priceFeed: PriceFeed;
  emitterChainId: number;
  priceServiceReceiveTime: number;
};

export interface PriceStore {
  getPriceIds(): Set<HexString>;
  getLatestPriceInfo(priceFeedId: HexString): PriceInfo | undefined;
  addUpdateListener(callback: (priceInfo: PriceInfo) => any): void;
}

type ListenerReadinessConfig = {
  spySyncTimeSeconds: number;
  numLoadedSymbols: number;
};

type ListenerConfig = {
  spyServiceHost: string;
  filtersRaw?: string;
  readiness: ListenerReadinessConfig;
};

type VaaHash = string;

export class Listener implements PriceStore {
  // Mapping of Price Feed Id to Vaa
  private priceFeedVaaMap = new Map<string, PriceInfo>();
  private promClient: PromClient | undefined;
  private spyServiceHost: string;
  private filters: FilterEntry[] = [];
  private spyConnectionTime: TimestampInSec | undefined;
  private readinessConfig: ListenerReadinessConfig;
  private updateCallbacks: ((priceInfo: PriceInfo) => any)[];
  private observedVaas: LRUCache<VaaHash, boolean>;

  constructor(config: ListenerConfig, promClient?: PromClient) {
    this.promClient = promClient;
    this.spyServiceHost = config.spyServiceHost;
    this.loadFilters(config.filtersRaw);
    this.readinessConfig = config.readiness;
    this.updateCallbacks = [];
    this.observedVaas = new LRUCache({
      max: 10000, // At most 10000 items
      ttl: 60 * 1000, // 60 seconds
    });
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

    while (true) {
      let stream: ClientReadableStream<SubscribeSignedVAAResponse> | undefined;
      try {
        const client = createSpyRPCServiceClient(
          process.env.SPY_SERVICE_HOST || ""
        );
        stream = await subscribeSignedVAA(client, { filters: this.filters });

        stream!.on("data", ({ vaaBytes }: { vaaBytes: Buffer }) => {
          this.processVaa(vaaBytes);
        });

        this.spyConnectionTime = new Date().getTime() / 1000;

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

  async processVaa(vaa: Buffer) {
    const { parse_vaa } = await importCoreWasm();

    const vaaHash: VaaHash = createHash("md5").update(vaa).digest("base64");

    if (this.observedVaas.has(vaaHash)) {
      return;
    }

    this.observedVaas.set(vaaHash, true);
    this.promClient?.incReceivedVaa();

    const parsedVaa = parse_vaa(vaa);

    let batchAttestation;

    try {
      batchAttestation = await parseBatchPriceAttestation(
        Buffer.from(parsedVaa.payload)
      );
    } catch (e: any) {
      logger.error(e, e.stack);
      logger.error("Parsing failed. Dropping vaa: %o", parsedVaa);
      return;
    }

    const isAnyPriceNew = batchAttestation.priceAttestations.some(
      (priceAttestation) => {
        const key = priceAttestation.priceId;
        const lastAttestationTime =
          this.priceFeedVaaMap.get(key)?.attestationTime;
        return (
          lastAttestationTime === undefined ||
          lastAttestationTime < priceAttestation.attestationTime
        );
      }
    );

    if (!isAnyPriceNew) {
      return;
    }

    for (const priceAttestation of batchAttestation.priceAttestations) {
      const key = priceAttestation.priceId;

      const lastAttestationTime =
        this.priceFeedVaaMap.get(key)?.attestationTime;

      if (
        lastAttestationTime === undefined ||
        lastAttestationTime < priceAttestation.attestationTime
      ) {
        const priceFeed = priceAttestationToPriceFeed(priceAttestation);
        const priceInfo = {
          seqNum: parsedVaa.sequence,
          vaa,
          publishTime: priceAttestation.publishTime,
          attestationTime: priceAttestation.attestationTime,
          priceFeed,
          emitterChainId: parsedVaa.emitter_chain,
          priceServiceReceiveTime: Math.floor(new Date().getTime() / 1000),
        };
        this.priceFeedVaaMap.set(key, priceInfo);

        if (lastAttestationTime !== undefined) {
          this.promClient?.addPriceUpdatesAttestationTimeGap(
            priceAttestation.attestationTime - lastAttestationTime
          );
        }

        const lastPublishTime = this.priceFeedVaaMap.get(key)?.publishTime;

        if (lastPublishTime !== undefined) {
          this.promClient?.addPriceUpdatesPublishTimeGap(
            priceAttestation.publishTime - lastPublishTime
          );
        }

        for (const callback of this.updateCallbacks) {
          callback(priceInfo);
        }
      }
    }

    logger.info(
      "Parsed a new Batch Price Attestation: [" +
        parsedVaa.emitter_chain +
        ":" +
        uint8ArrayToHex(parsedVaa.emitter_address) +
        "], seqNum: " +
        parsedVaa.sequence +
        ", Batch Summary: " +
        getBatchSummary(batchAttestation)
    );
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
}
