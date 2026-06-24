/* biome-ignore-all lint/style/noNonNullAssertion: pre-existing; metrics wiring asserts on optional config */
/* biome-ignore-all lint/suspicious/noExplicitAny: pre-existing; yargs argv is untyped */
import fs from "node:fs";

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
import { createSuiProvider, SuiPriceListener, SuiPricePusher } from "./sui.js";

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
        "`polling-frequency` command-line argument. For `--endpoint-type grpc` " +
        "this is the gRPC-web base URL.",
      required: true,
      type: "string",
    } as Options,
    "endpoint-type": {
      choices: ["json-rpc", "grpc"],
      default: "json-rpc",
      description:
        "Transport to use for the Sui RPC endpoint. Sui Foundation is deprecating " +
        "JSON-RPC (public endpoints off July 2026, removed by mid-Oct 2026); use " +
        "`grpc` to migrate. `grpc` relies on @mysten/sui's experimental SuiGrpcClient.",
      required: false,
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
    network: {
      choices: ["mainnet", "testnet", "devnet", "localnet"],
      description:
        "Sui network label for the RPC client. This selects the network the " +
        "endpoint serves; it does not change which `--endpoint` URL is used.",
      required: true,
      type: "string",
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
    ...options.hermesAccessToken,
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
      endpointType,
      network,
      priceConfigFile,
      priceServiceEndpoint,
      hermesAccessToken,
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
    const hermesClient = new HermesClient(priceServiceEndpoint, {
      accessToken: hermesAccessToken,
    });

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

    const suiClient = createSuiProvider(endpointType, network, endpoint);

    const suiListener = new SuiPriceListener(
      pythStateId,
      wormholeStateId,
      endpoint,
      endpointType,
      network,
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
      endpointType,
      network,
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
