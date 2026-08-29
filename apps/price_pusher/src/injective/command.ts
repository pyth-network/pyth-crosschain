/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";

import { getNetworkInfo } from "@injectivelabs/networks";
import { HermesClient } from "@pythnetwork/hermes-client";
import { pino } from "pino";
import type { Options } from "yargs";
import { Controller } from "../controller.js";
import * as options from "../options.js";
import { readPriceConfigFile } from "../price-config.js";
import { PythPriceListener } from "../pyth-price-listener.js";
import { filterInvalidPriceItems } from "../utils.js";
import { InjectivePriceListener, InjectivePricePusher } from "./injective.js";
export default {
  builder: {
    "gas-multiplier": {
      description: "Gas multiplier to be used for each transaction",
      type: "number",
    } as Options,
    "gas-price": {
      description: "Gas price to be used for each transaction",
      type: "number",
    } as Options,
    "grpc-endpoint": {
      description:
        "gRPC endpoint URL(s) for injective. The pusher will periodically " +
        "poll for updates. The polling interval is configurable via the " +
        "`polling-frequency` command-line argument. " +
        "Pass the flag multiple times or supply a comma-separated list " +
        "(e.g. `--grpc-endpoint a,b`) to register a fallback set; the " +
        "pusher will round-robin through them on gRPC errors.",
      type: "array",
      string: true,
      required: true,
    } as Options,
    network: {
      description: "testnet or mainnet",
      required: true,
      type: "string",
    } as Options,
    "price-ids-process-chunk-size": {
      description:
        "Set in case we wanna split price feeds updates into chunks to have smaller transactions. Set to -1 to disable chunking.",
      required: false,
      type: "number",
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.hermesAccessToken,
    ...options.mnemonicFile,
    ...options.pythContractAddress,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
    ...options.logLevel,
    ...options.controllerLogLevel,
  },
  command: "injective",
  describe: "run price pusher for injective",
  handler: async function (argv: any) {
    // FIXME: type checks for this
    const {
      network,
      logLevel,
      gasPrice,
      grpcEndpoint,
      mnemonicFile,
      gasMultiplier,
      priceConfigFile,
      pollingFrequency,
      pushingFrequency,
      controllerLogLevel,
      pythContractAddress,
      priceServiceEndpoint,
      hermesAccessToken,
      priceIdsProcessChunkSize,
    } = argv;

    const logger = pino({ level: logLevel });

    if (network !== "testnet" && network !== "mainnet") {
      throw new Error("Please specify network. One of [testnet, mainnet]");
    }

    const priceConfigs = readPriceConfigFile(priceConfigFile);
    const hermesClient = new HermesClient(priceServiceEndpoint, {
      accessToken: hermesAccessToken,
    });
    const mnemonic = fs.readFileSync(mnemonicFile, "utf8").trim();

    // `grpc-endpoint` is `type: "array"` so yargs always hands us a list. Each
    // entry may itself be a comma-separated string (e.g. `--grpc-endpoint a,b`),
    // so split + trim + drop empties to get a clean failover set.
    const grpcEndpoints: string[] = (grpcEndpoint as string[])
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (grpcEndpoints.length === 0) {
      throw new Error(
        "At least one --grpc-endpoint must be provided. Pass the flag once per " +
          "endpoint, or supply a comma-separated list.",
      );
    }

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

    const injectiveListener = new InjectivePriceListener(
      pythContractAddress,
      grpcEndpoints,
      priceItems,
      logger.child({ module: "InjectivePriceListener" }),
      {
        pollingFrequency,
      },
    );
    const injectivePusher = new InjectivePricePusher(
      hermesClient,
      pythContractAddress,
      grpcEndpoints,
      logger.child({ module: "InjectivePricePusher" }),
      mnemonic,
      {
        chainId: getNetworkInfo(network).chainId,
        gasMultiplier,
        gasPrice,
        priceIdsProcessChunkSize,
      },
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      injectiveListener,
      injectivePusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      { pushingFrequency },
    );

    void controller.start();
  },
};
