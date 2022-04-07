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

import * as helpers from "./helpers";
import { logger } from "./helpers";
import { PromHelper } from "./promHelpers";
import { getBatchSummary, parseBatchPriceAttestation } from "@certusone/p2w-sdk";
import { ClientReadableStream } from "@grpc/grpc-js";
import { SubscribeSignedVAAResponse } from "@certusone/wormhole-spydk/lib/cjs/proto/spy/v1/spy";

let seqMap = new Map<string, number>();
let metrics: PromHelper;

export function init(): boolean {
  if (!process.env.SPY_SERVICE_HOST) {
    logger.error("Missing environment variable SPY_SERVICE_HOST");
    return false;
  }

  return true;
}

// Run this function without blocking (`await`) if you want to run it async.
export async function run(pm: PromHelper) {
  metrics = pm;
  logger.info(
    "pyth_relay starting up, will listen for signed VAAs from [" +
      process.env.SPY_SERVICE_HOST +
      "]"
  );
  
  let filter = {};
  if (process.env.SPY_SERVICE_FILTERS) {
    const parsedJsonFilters = eval(process.env.SPY_SERVICE_FILTERS);

    let myFilters = [];
    for (let i = 0; i < parsedJsonFilters.length; i++) {
      let myChainId = parseInt(parsedJsonFilters[i].chain_id) as ChainId;
      let myEmitterAddress = parsedJsonFilters[i].emitter_address;
      let myEmitterFilter = {
        emitterFilter: {
          chainId: myChainId,
          emitterAddress: myEmitterAddress,
        },
      };
      logger.info(
        "adding filter: chainId: [" +
          myEmitterFilter.emitterFilter.chainId +
          "], emitterAddress: [" +
          myEmitterFilter.emitterFilter.emitterAddress +
          "]"
      );
      myFilters.push(myEmitterFilter);
    }

    logger.info("setting " + myFilters.length + " filters");
    filter = {
      filters: myFilters,
    };
  } else {
    logger.info("No filters provided. Processing all signed VAAs");
  }

  while (true) {
    let stream: ClientReadableStream<SubscribeSignedVAAResponse> | undefined;
    try {
      const client = createSpyRPCServiceClient(
        process.env.SPY_SERVICE_HOST || ""
      );
      stream = await subscribeSignedVAA(client, filter);

      stream!.on("data", ({ vaaBytes }: { vaaBytes: string }) => {
        processVaa(vaaBytes);
      });

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
        await helpers.sleep(1000);
      }
    } catch (e) {
      logger.error("spy service threw an exception: %o", e);
    }

    if (stream) {
      stream.destroy();
    }

    await helpers.sleep(1000);
    logger.info("attempting to reconnect to the spy service");
  }
  
}

async function processVaa(vaaBytes: string) {
  logger.info("received: a new VAA");
  const { parse_vaa } = await importCoreWasm();
  const parsedVAA = parse_vaa(hexToUint8Array(vaaBytes));

  let batchAttestation;

  try {
    batchAttestation = parseBatchPriceAttestation(
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
      let lastSeqNum = seqMap.get(key);
      return lastSeqNum === undefined || lastSeqNum < parsedVAA.sequence;
    }
  );

  if (!isAnyPriceNew) {
    logger.debug(
      "For all prices there exists an update with newer sequence number, ignoring this attestation." + 
      "batch price attestation: %o",
      batchAttestation
    );
    return;
  }

  for (let priceAttestation of batchAttestation.priceAttestations) {
    const key = priceAttestation.priceId;

    let lastSeqNum = seqMap.get(key);
    if (lastSeqNum === undefined || lastSeqNum < parsedVAA.sequence) {
      seqMap.set(key, parsedVAA.sequence);
    }
  }

  logger.info(
    "received: emitter: [" +
      parsedVAA.emitter_chain +
      ":" +
      uint8ArrayToHex(parsedVAA.emitter_address) +
      "], seqNum: " +
      parsedVAA.sequence +
      ", Batch Summary: " +
      getBatchSummary(batchAttestation)
  );

  metrics.incIncoming();
}
