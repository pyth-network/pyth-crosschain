import { HermesClient } from "@pythnetwork/hermes-client";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import fs from "fs";
import { PythPriceListener } from "../pyth-price-listener";
import { Controller } from "../controller";
import { Options } from "yargs";
import {
  AptosPriceListener,
  AptosPricePusher,
  APTOS_ACCOUNT_HD_PATH,
} from "./aptos";
import { AptosAccount } from "aptos";
import pino from "pino";
import { filterInvalidPriceItems } from "../utils";
import { PricePusherMetrics } from "../metrics";
import { createAptosBalanceTracker } from "./balance-tracker";

export default {
  command: "aptos",
  describe: "run price pusher for aptos",
  builder: {
    endpoint: {
      description:
        "RPC endpoint endpoint URL for aptos. The pusher will periodically" +
        "poll for updates. The polling interval is configurable via the " +
        "`polling-frequency` command-line argument.",
      type: "string",
      required: true,
    } as Options,
    "override-gas-price-multiplier": {
      description:
        "Multiply the gas price by this number if the transaction is not landing to override it. Default 2",
      type: "number",
      required: false,
      default: 2,
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.mnemonicFile,
    ...options.pythContractAddress,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
    ...options.logLevel,
    ...options.controllerLogLevel,
    ...options.enableMetrics,
    ...options.metricsPort,
  },
  handler: async function (argv: any) {
    // FIXME: type checks for this
    const {
      endpoint,
      priceConfigFile,
      priceServiceEndpoint,
      mnemonicFile,
      pythContractAddress,
      pushingFrequency,
      pollingFrequency,
      overrideGasPriceMultiplier,
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

    const mnemonic = fs.readFileSync(mnemonicFile, "utf-8").trim();
    const account = AptosAccount.fromDerivePath(
      APTOS_ACCOUNT_HD_PATH,
      mnemonic,
    );
    logger.info(`Pushing from account address: ${account.address()}`);

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

    const aptosListener = new AptosPriceListener(
      pythContractAddress,
      endpoint,
      priceItems,
      logger.child({ module: "AptosPriceListener" }),
      { pollingFrequency },
    );

    const aptosPusher = new AptosPricePusher(
      hermesClient,
      logger.child({ module: "AptosPricePusher" }),
      pythContractAddress,
      endpoint,
      mnemonic,
      overrideGasPriceMultiplier,
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      aptosListener,
      aptosPusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      {
        pushingFrequency,
        metrics,
      },
    );

    // Create and start the balance tracker if metrics are enabled
    if (metrics) {
      const balanceTracker = createAptosBalanceTracker({
        address: account.address().toString(),
        endpoint,
        network: "aptos",
        updateInterval: pushingFrequency,
        metrics,
        logger: logger.child({ module: "AptosBalanceTracker" }),
      });

      // Start the balance tracker
      await balanceTracker.start();
    }

    controller.start();
  },
};
