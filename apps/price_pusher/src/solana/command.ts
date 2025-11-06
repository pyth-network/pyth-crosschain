/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";

import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet.js";
import { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import {
  Keypair,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  searcherClient,
  SearcherClient,
} from "jito-ts/dist/sdk/block-engine/searcher";
import type { Logger } from "pino";
import { pino } from "pino";
import type { Options } from "yargs";

import * as options from "../options.js";
import { readPriceConfigFile } from "../price-config.js";
import { PythPriceListener } from "../pyth-price-listener.js";
import {
  SolanaPriceListener,
  SolanaPricePusher,
  SolanaPricePusherJito,
} from "./solana.js";
import { Controller } from "../controller.js";
import type { IBalanceTracker } from "../interface.js";
import { PricePusherMetrics } from "../metrics.js";
import { filterInvalidPriceItems } from "../utils.js";
import { createSolanaBalanceTracker } from "./balance-tracker.js";

export default {
  command: "solana",
  describe: "run price pusher for solana",
  builder: {
    endpoint: {
      description: "Solana RPC API endpoint",
      type: "string",
      required: true,
    } as Options,
    "keypair-file": {
      description: "Path to a keypair file",
      type: "string",
      required: true,
    } as Options,
    "shard-id": {
      description: "Shard ID",
      type: "number",
      required: true,
    } as Options,
    "compute-unit-price-micro-lamports": {
      description: "Priority fee per compute unit",
      type: "number",
      default: 50_000,
    } as Options,
    "jito-endpoints": {
      description: "Jito endpoint(s) - comma-separated list of endpoints",
      type: "string",
      optional: true,
    } as Options,
    "jito-keypair-file": {
      description:
        "Path to the jito keypair file (need for grpc authentication)",
      type: "string",
      optional: true,
    } as Options,
    "jito-tip-lamports": {
      description: "Lamports to tip the jito builder",
      type: "number",
      optional: true,
    } as Options,
    "dynamic-jito-tips": {
      description: "Use dynamic jito tips",
      type: "boolean",
      default: false,
    } as Options,
    "max-jito-tip-lamports": {
      description: "Maximum jito tip lamports",
      type: "number",
      default: LAMPORTS_PER_SOL / 100,
    } as Options,
    "jito-bundle-size": {
      description: "Number of transactions in each Jito bundle",
      type: "number",
      default: 5,
    } as Options,
    "updates-per-jito-bundle": {
      description: "Number of price updates in each Jito bundle",
      type: "number",
      default: 6,
    } as Options,
    "address-lookup-table-account": {
      description: "The pubkey of the ALT to use when updating price feeds",
      type: "string",
      optional: true,
    } as Options,
    "treasury-id": {
      description:
        "The treasuryId to use. Useful when the corresponding treasury account is indexed in the ALT passed to --address-lookup-table-account. This is a tx size optimization and is optional; if not set, a random treasury account will be used.",
      type: "number",
      optional: true,
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.pythContractAddress,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
    ...options.logLevel,
    ...options.controllerLogLevel,
    ...options.enableMetrics,
    ...options.metricsPort,
  },
  handler: async function (argv: any) {
    const {
      endpoint,
      keypairFile,
      shardId,
      computeUnitPriceMicroLamports,
      priceConfigFile,
      priceServiceEndpoint,
      pythContractAddress,
      pushingFrequency,
      pollingFrequency,
      jitoEndpoints,
      jitoKeypairFile,
      jitoTipLamports,
      dynamicJitoTips,
      maxJitoTipLamports,
      updatesPerJitoBundle,
      addressLookupTableAccount,
      treasuryId,
      logLevel,
      controllerLogLevel,
      enableMetrics,
      metricsPort,
    } = argv;

    const logger = pino({ level: logLevel });

    const priceConfigs = readPriceConfigFile(priceConfigFile);

    const hermesClient = new HermesClient(priceServiceEndpoint);

    // Initialize metrics if enabled
    let metrics: PricePusherMetrics | undefined;
    if (enableMetrics) {
      metrics = new PricePusherMetrics(logger.child({ module: "Metrics" }));
      metrics.start(metricsPort);
      logger.info(`Metrics server started on port ${metricsPort}`);
    }

    let priceItems = priceConfigs.map(({ id, alias }) => ({ id, alias }));

    // Better to filter out invalid price items before creating the pyth listener
    const { existingPriceItems, invalidPriceItems } =
      await filterInvalidPriceItems(hermesClient, priceItems);

    if (invalidPriceItems.length > 0) {
      logger.error(
        `Invalid price id submitted for: ${invalidPriceItems
          .map(({ alias }) => alias)
          .join(", ")}`,
      );
    }

    priceItems = existingPriceItems;

    const pythListener = new PythPriceListener(
      hermesClient,
      priceItems,
      logger.child({ module: "PythPriceListener" }),
    );

    const keypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(keypairFile, "ascii"))),
    );
    const wallet = new NodeWallet(keypair);

    const connection = new Connection(endpoint, "processed");
    const pythSolanaReceiver = new PythSolanaReceiver({
      connection,
      wallet,
      pushOracleProgramId: new PublicKey(pythContractAddress),
      treasuryId: treasuryId,
    });

    // Create and start the balance tracker if metrics are enabled
    if (metrics) {
      const balanceTracker: IBalanceTracker = createSolanaBalanceTracker({
        connection,
        publicKey: keypair.publicKey,
        network: "solana",
        updateInterval: 60,
        metrics,
        logger,
      });

      // Start the balance tracker
      await balanceTracker.start();
    }

    // Fetch the account lookup table if provided
    const lookupTableAccount = addressLookupTableAccount
      ? await connection
          .getAddressLookupTable(new PublicKey(addressLookupTableAccount))
          .then((result) => result.value ?? undefined)
      : undefined;

    let solanaPricePusher;
    if (jitoTipLamports) {
      const jitoKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(jitoKeypairFile, "ascii"))),
      );

      const jitoEndpointsList = jitoEndpoints
        .split(",")
        .map((endpoint: string) => endpoint.trim());
      const jitoClients: SearcherClient[] = jitoEndpointsList.map(
        (endpoint: string) => {
          logger.info(
            `Constructing Jito searcher client from endpoint ${endpoint}`,
          );
          return searcherClient(endpoint, jitoKeypair);
        },
      );

      solanaPricePusher = new SolanaPricePusherJito(
        pythSolanaReceiver,
        hermesClient,
        logger.child({ module: "SolanaPricePusherJito" }),
        shardId,
        jitoTipLamports,
        dynamicJitoTips,
        maxJitoTipLamports,
        jitoClients,
        updatesPerJitoBundle,
        // Set max retry time to pushing frequency, since we want to stop retrying before the next push attempt
        pushingFrequency * 1000,
        lookupTableAccount,
      );

      for (const [index, client] of jitoClients.entries()) {
        onBundleResult(client, logger.child({ module: `JitoClient-${index}` }));
      }
    } else {
      solanaPricePusher = new SolanaPricePusher(
        pythSolanaReceiver,
        hermesClient,
        logger.child({ module: "SolanaPricePusher" }),
        shardId,
        computeUnitPriceMicroLamports,
        lookupTableAccount,
      );
    }

    const solanaPriceListener = new SolanaPriceListener(
      pythSolanaReceiver,
      shardId,
      priceItems,
      logger.child({ module: "SolanaPriceListener" }),
      { pollingFrequency },
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      solanaPriceListener,
      solanaPricePusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      {
        pushingFrequency,
        metrics: metrics!,
      },
    );

    void controller.start();
  },
};

export const onBundleResult = (c: SearcherClient, logger: Logger) => {
  try {
    c.onBundleResult(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
      (err) => {
        logger.error(err, "Error in bundle result");
      },
    );
  } catch (error) {
    logger.error(error, "Exception in bundle result");
  }
};
