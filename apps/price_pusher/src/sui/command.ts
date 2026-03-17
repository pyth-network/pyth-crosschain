/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";

import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { HermesClient } from "@pythnetwork/hermes-client";
import pino from "pino";
import type { Options } from "yargs";

import { Controller } from "../controller.js";
import { PricePusherMetrics } from "../metrics.js";
import * as options from "../options.js";
import { readPriceConfigFile } from "../price-config";
import { PythPriceListener } from "../pyth-price-listener.js";
import { filterInvalidPriceItems } from "../utils.js";
import { createSuiBalanceTracker } from "./balance-tracker.js";
import { SuiPriceListener, SuiPricePusher } from "./sui.js";

export default {
  builder: {
    "account-index": {
      default: 0,
      description: "Index of the account to use derived by the mnemonic",
      required: true,
      type: "number",
    } as Options,
    endpoint: {
      description:
        "RPC endpoint URL for sui. The pusher will periodically" +
        "poll for updates. The polling interval is configurable via the " +
        "`polling-frequency` command-line argument.",
      required: true,
      type: "string",
    } as Options,
    "gas-budget": {
      default: 500_000_000,
      description: "Gas budget for each price update",
      required: true,
      type: "number",
    } as Options,
    "ignore-gas-objects": {
      default: [],
      description:
        "Gas objects to ignore when merging gas objects on startup -- use this for locked objects.",
      required: false,
      type: "array",
    } as Options,
    "num-gas-objects": {
      default: 30,
      description: "Number of gas objects in the pool.",
      required: true,
      type: "number",
    } as Options,
    "pyth-state-id": {
      description:
        "Pyth State Id. Can be found here" +
        "https://docs.pyth.network/documentation/pythnet-price-feeds/sui",
      required: true,
      type: "string",
    } as Options,
    "wormhole-state-id": {
      description:
        "Wormhole State Id. Can be found here" +
        "https://docs.pyth.network/documentation/pythnet-price-feeds/sui",
      required: true,
      type: "string",
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.mnemonicFile,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
    ...options.logLevel,
    ...options.controllerLogLevel,
    ...options.enableMetrics,
    ...options.metricsPort,
  },
  command: "sui",
  describe:
    "Run price pusher for sui. Most of the arguments below are" +
    "network specific, so there's one set of values for mainnet and" +
    " another for testnet. See config.sui.mainnet.sample.json for the " +
    "appropriate values for your network. ",
  handler: async function (argv: any) {
    const {
      endpoint,
      priceConfigFile,
      priceServiceEndpoint,
      mnemonicFile,
      pushingFrequency,
      pollingFrequency,
      pythStateId,
      wormholeStateId,
      numGasObjects,
      ignoreGasObjects,
      gasBudget,
      accountIndex,
      logLevel,
      controllerLogLevel,
      enableMetrics,
      metricsPort,
    } = argv;

    const logger = pino({ level: logLevel });

    const priceConfigs = readPriceConfigFile(priceConfigFile);
    const hermesClient = new HermesClient(priceServiceEndpoint);

    const mnemonic = fs.readFileSync(mnemonicFile, "utf8").trim();
    const keypair = Ed25519Keypair.deriveKeypair(
      mnemonic,
      `m/44'/784'/${accountIndex}'/0'/0'`,
    );
    const suiAddress = keypair.getPublicKey().toSuiAddress();
    logger.info(`Pushing updates from wallet address: ${suiAddress}`);

    let priceItems = priceConfigs.map(({ id, alias }) => ({ alias, id }));

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

    // Initialize metrics if enabled
    let metrics: PricePusherMetrics | undefined;
    if (enableMetrics) {
      metrics = new PricePusherMetrics(logger.child({ module: "Metrics" }));
      metrics.start(metricsPort);
      logger.info(`Metrics server started on port ${metricsPort}`);
    }

    const pythListener = new PythPriceListener(
      hermesClient,
      priceItems,
      logger.child({ module: "PythPriceListener" }),
    );

    const suiClient = new SuiClient({ url: endpoint });

    const suiListener = new SuiPriceListener(
      pythStateId,
      wormholeStateId,
      endpoint,
      priceItems,
      logger.child({ module: "SuiPriceListener" }),
      { pollingFrequency },
    );

    const suiPusher = await SuiPricePusher.createWithAutomaticGasPool(
      hermesClient,
      logger.child({ module: "SuiPricePusher" }),
      pythStateId,
      wormholeStateId,
      endpoint,
      keypair,
      gasBudget,
      numGasObjects,
      ignoreGasObjects,
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      suiListener,
      suiPusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      {
        metrics: metrics!,
        pushingFrequency,
      },
    );

    // Create and start the balance tracker if metrics are enabled
    if (metrics) {
      const balanceTracker = createSuiBalanceTracker({
        address: suiAddress,
        client: suiClient,
        logger,
        metrics,
        network: "sui",
        updateInterval: pushingFrequency,
      });

      // Start the balance tracker
      await balanceTracker.start();
    }

    void controller.start();
  },
};
