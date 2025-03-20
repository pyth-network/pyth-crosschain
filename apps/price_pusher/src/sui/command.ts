import { HermesClient } from "@pythnetwork/hermes-client";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import fs from "fs";
import { PythPriceListener } from "../pyth-price-listener";
import { Controller } from "../controller";
import { Options } from "yargs";
import { SuiPriceListener, SuiPricePusher } from "./sui";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import pino from "pino";
import { filterInvalidPriceItems } from "../utils";
import { PricePusherMetrics } from "../metrics";
import { createSuiBalanceTracker } from "./balance-tracker";
import { SuiClient } from "@mysten/sui/client";

export default {
  command: "sui",
  describe:
    "Run price pusher for sui. Most of the arguments below are" +
    "network specific, so there's one set of values for mainnet and" +
    " another for testnet. See config.sui.mainnet.sample.json for the " +
    "appropriate values for your network. ",
  builder: {
    endpoint: {
      description:
        "RPC endpoint URL for sui. The pusher will periodically" +
        "poll for updates. The polling interval is configurable via the " +
        "`polling-frequency` command-line argument.",
      type: "string",
      required: true,
    } as Options,
    "pyth-state-id": {
      description:
        "Pyth State Id. Can be found here" +
        "https://docs.pyth.network/documentation/pythnet-price-feeds/sui",
      type: "string",
      required: true,
    } as Options,
    "wormhole-state-id": {
      description:
        "Wormhole State Id. Can be found here" +
        "https://docs.pyth.network/documentation/pythnet-price-feeds/sui",
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

    const mnemonic = fs.readFileSync(mnemonicFile, "utf-8").trim();
    const keypair = Ed25519Keypair.deriveKeypair(
      mnemonic,
      `m/44'/784'/${accountIndex}'/0'/0'`,
    );
    const suiAddress = keypair.getPublicKey().toSuiAddress();
    logger.info(`Pushing updates from wallet address: ${suiAddress}`);

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
        pushingFrequency,
        metrics,
      },
    );

    // Create and start the balance tracker if metrics are enabled
    if (metrics) {
      const balanceTracker = createSuiBalanceTracker({
        client: suiClient,
        address: suiAddress,
        network: "sui",
        updateInterval: pushingFrequency,
        metrics,
        logger,
      });

      // Start the balance tracker
      await balanceTracker.start();
    }

    controller.start();
  },
};
