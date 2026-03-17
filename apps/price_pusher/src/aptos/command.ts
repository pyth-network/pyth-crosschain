/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";

import { HermesClient } from "@pythnetwork/hermes-client";
import { AptosAccount } from "aptos";
import pino from "pino";
import type { Options } from "yargs";

import { Controller } from "../controller.js";
import { PricePusherMetrics } from "../metrics.js";
import * as options from "../options.js";
import { readPriceConfigFile } from "../price-config.js";
import { PythPriceListener } from "../pyth-price-listener.js";
import { filterInvalidPriceItems } from "../utils.js";
import {
  APTOS_ACCOUNT_HD_PATH,
  AptosPriceListener,
  AptosPricePusher,
} from "./aptos.js";
import { createAptosBalanceTracker } from "./balance-tracker.js";

export default {
  builder: {
    endpoint: {
      description:
        "RPC endpoint endpoint URL for aptos. The pusher will periodically" +
        "poll for updates. The polling interval is configurable via the " +
        "`polling-frequency` command-line argument.",
      required: true,
      type: "string",
    } as Options,
    "override-gas-price-multiplier": {
      default: 2,
      description:
        "Multiply the gas price by this number if the transaction is not landing to override it. Default 2",
      required: false,
      type: "number",
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
  command: "aptos",
  describe: "run price pusher for aptos",
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

    const mnemonic = fs.readFileSync(mnemonicFile, "utf8").trim();
    const account = AptosAccount.fromDerivePath(
      APTOS_ACCOUNT_HD_PATH,
      mnemonic,
    );
    logger.info(`Pushing from account address: ${account.address()}`);

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
        metrics: metrics!,
        pushingFrequency,
      },
    );

    // Create and start the balance tracker if metrics are enabled
    if (metrics) {
      const balanceTracker = createAptosBalanceTracker({
        address: account.address().toString(),
        endpoint,
        logger: logger.child({ module: "AptosBalanceTracker" }),
        metrics,
        network: "aptos",
        updateInterval: pushingFrequency,
      });

      // Start the balance tracker
      await balanceTracker.start();
    }

    void controller.start();
  },
};
