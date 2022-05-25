import {
  ChainId,
  hexToUint8Array,
  uint8ArrayToHex,
} from "@certusone/wormhole-sdk";

import {
  createSpyRPCServiceClient,
  subscribeSignedVAA,
} from "@certusone/wormhole-spydk";

import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import { envOrErr, sleep, TimestampInSec } from "./helpers";
import { PromClient } from "./promClient";
import {
  getBatchSummary,
  parseBatchPriceAttestation,
  priceAttestationToPriceFeed,
} from "@certusone/p2w-sdk";
import { ClientReadableStream } from "@grpc/grpc-js";
import {
  FilterEntry,
  SubscribeSignedVAAResponse,
} from "@certusone/wormhole-spydk/lib/cjs/proto/spy/v1/spy";
import { logger } from "./logging";
import { HexString, PriceFeed } from "@pythnetwork/pyth-sdk-js";

export type PriceInfo = {
  vaaBytes: string;
  seqNum: number;
  receiveTime: TimestampInSec;
  priceFeed: PriceFeed;
};

export interface PriceStore {
  getPriceIds(): Set<HexString>;
  getLatestPriceInfo(priceFeedId: HexString): PriceInfo | undefined;
  addUpdateListener(callback: (priceFeed: PriceFeed) => any): void;
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

export class Listener implements PriceStore {
  // Mapping of Price Feed Id to Vaa
  private priceFeedVaaMap = new Map<string, PriceInfo>();
  private promClient: PromClient | undefined;
  private spyServiceHost: string;
  private filters: FilterEntry[] = [];
  private spyConnectionTime: TimestampInSec | undefined;
  private readinessConfig: ListenerReadinessConfig;
  private updateCallbacks: ((priceFeed: PriceFeed) => any)[];

  constructor(config: ListenerConfig, promClient?: PromClient) {
    this.promClient = promClient;
    this.spyServiceHost = config.spyServiceHost;
    this.loadFilters(config.filtersRaw);
    this.readinessConfig = config.readiness;
    this.updateCallbacks = [];
  }

  private loadFilters(filtersRaw?: string) {
    if (!filtersRaw) {
      logger.info("No filters provided. Will process all signed VAAs");
      return;
    }

    const parsedJsonFilters = eval(filtersRaw);

    for (let i = 0; i < parsedJsonFilters.length; i++) {
      let myChainId = parseInt(parsedJsonFilters[i].chain_id) as ChainId;
      let myEmitterAddress = parsedJsonFilters[i].emitter_address;
      let myEmitterFilter: FilterEntry = {
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

        stream!.on("data", ({ vaaBytes }: { vaaBytes: string }) => {
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

  async processVaa(vaaBytes: string) {
    logger.info("Received a new VAA");
    const { parse_vaa } = await importCoreWasm();
    const parsedVAA = parse_vaa(hexToUint8Array(vaaBytes));

    let batchAttestation;

    try {
      batchAttestation = await parseBatchPriceAttestation(
        Buffer.from(parsedVAA.payload)
      );
    } catch (e: any) {
      logger.error(e, e.stack);
      logger.error("Parsing failed. Dropping vaa: %o", parsedVAA);
      return;
    }

    let isAnyPriceNew = batchAttestation.priceAttestations.some(
      (priceAttestation) => {
        const key = priceAttestation.priceId;
        let lastSeqNum = this.priceFeedVaaMap.get(key)?.seqNum;
        return lastSeqNum === undefined || lastSeqNum < parsedVAA.sequence;
      }
    );

    if (!isAnyPriceNew) {
      return;
    }

    for (let priceAttestation of batchAttestation.priceAttestations) {
      const key = priceAttestation.priceId;

      let lastSeqNum = this.priceFeedVaaMap.get(key)?.seqNum;
      if (lastSeqNum === undefined || lastSeqNum < parsedVAA.sequence) {
        const priceFeed = priceAttestationToPriceFeed(priceAttestation);
        this.priceFeedVaaMap.set(key, {
          seqNum: parsedVAA.sequence,
          vaaBytes: vaaBytes,
          receiveTime: new Date().getTime() / 1000,
          priceFeed,
        });

        for (let callback of this.updateCallbacks) {
          callback(priceFeed);
        }
      }
    }

    logger.info(
      "Parsed a new Batch Price Attestation: [" +
        parsedVAA.emitter_chain +
        ":" +
        uint8ArrayToHex(parsedVAA.emitter_address) +
        "], seqNum: " +
        parsedVAA.sequence +
        ", Batch Summary: " +
        getBatchSummary(batchAttestation)
    );

    this.promClient?.incReceivedVaa();
  }

  getLatestPriceInfo(priceFeedId: string): PriceInfo | undefined {
    return this.priceFeedVaaMap.get(priceFeedId);
  }

  addUpdateListener(callback: (priceFeed: PriceFeed) => any) {
    this.updateCallbacks.push(callback);
  }

  getPriceIds(): Set<HexString> {
    return new Set(this.priceFeedVaaMap.keys());
  }

  isReady(): boolean {
    let currentTime: TimestampInSec = new Date().getTime() / 1000;
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
