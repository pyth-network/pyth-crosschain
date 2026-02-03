/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";

import { IotaClient } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { HermesClient } from "@pythnetwork/hermes-client";
import pino from "pino";
import type { Options } from "yargs";

import { Controller } from "../controller.js";
import { PricePusherMetrics } from "../metrics.js";
import * as options from "../options.js";
import { readPriceConfigFile } from "../price-config";
import { PythPriceListener } from "../pyth-price-listener.js";
import { createIotaBalanceTracker } from "./balance-tracker.js";
import { IotaPriceListener, IotaPricePusher } from "./iota.js";
import { filterInvalidPriceItems } from "../utils.js";

export default {
  command: "iota",
  describe:
    "Run price pusher for iota. Most of the arguments below are" +
    "network specific, so there's one set of values for mainnet and" +
    " another for testnet. See config.iota.mainnet.sample.json for the " +
    "appropriate values for your network. ",
  builder: {
    endpoint: {
      description:
        "RPC endpoint URL for iota. The pusher will periodically" +
        "poll for updates. The polling interval is configurable via the " +
        "`polling-frequency` command-line argument.",
      type: "string",
      required: true,
    } as Options,
    "pyth-state-id": {
      description:
        "Pyth State Id. Can be found here" +
        "https://docs.pyth.network/documentation/pythnet-price-feeds/iota",
      type: "string",
      required: true,
    } as Options,
    "wormhole-state-id": {
      description:
        "Wormhole State Id. Can be found here" +
        "https://docs.pyth.network/documentation/pythnet-price-feeds/iota",
      type: "string",
      required: true,
    } as Options,
    "num-gas-objects": {
      description: "Number of gas objects in the pool.",
      type: "number",
      required: true,
      default: 30,
    } as Options,
    "ignore-gas-objects": {
      description:
        "Gas objects to ignore when merging gas objects on startup -- use this for locked objects.",
      type: "array",
      required: false,
      default: [],
    } as Options,
    "gas-budget": {
      description: "Gas budget for each price update",
      type: "number",
      required: true,
      default: 500_000_000,
    } as Options,
    "account-index": {
      description: "Index of the account to use derived by the mnemonic",
      type: "number",
      required: true,
      default: 0,
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
      `m/44'/4218'/${accountIndex}'/0'/0'`,
    );
    const iotaAddress = keypair.getPublicKey().toIotaAddress();
    logger.info(`Pushing updates from wallet address: ${iotaAddress}`);

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

    const iotaClient = new IotaClient({ url: endpoint });

    const iotaListener = new IotaPriceListener(
      pythStateId,
      wormholeStateId,
      endpoint,
      priceItems,
      logger.child({ module: "IotaPriceListener" }),
      { pollingFrequency },
    );

    const iotaPusher = await IotaPricePusher.createWithAutomaticGasPool(
      hermesClient,
      logger.child({ module: "IotaPricePusher" }),
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
      iotaListener,
      iotaPusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      {
        pushingFrequency,
        metrics: metrics!,
      },
    );

    // Create and start the balance tracker if metrics are enabled
    if (metrics) {
      const balanceTracker = createIotaBalanceTracker({
        client: iotaClient,
        address: iotaAddress,
        network: "iota",
        updateInterval: pushingFrequency,
        metrics,
        logger,
      });

      // Start the balance tracker
      await balanceTracker.start();
    }

    void controller.start();
  },
};
