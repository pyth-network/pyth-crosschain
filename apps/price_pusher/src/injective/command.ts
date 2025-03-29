import { HermesClient } from "@pythnetwork/hermes-client";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import fs from "fs";
import { InjectivePriceListener, InjectivePricePusher } from "./injective";
import { PythPriceListener } from "../pyth-price-listener";
import { Controller } from "../controller";
import { Options } from "yargs";
import { getNetworkInfo } from "@injectivelabs/networks";
import pino from "pino";
import { filterInvalidPriceItems } from "../utils";
export default {
  command: "injective",
  describe: "run price pusher for injective",
  builder: {
    "grpc-endpoint": {
      description:
        "gRPC endpoint URL for injective. The pusher will periodically" +
        "poll for updates. The polling interval is configurable via the " +
        "`polling-frequency` command-line argument.",
      type: "string",
      required: true,
    } as Options,
    network: {
      description: "testnet or mainnet",
      type: "string",
      required: true,
    } as Options,
    "gas-price": {
      description: "Gas price to be used for each transaction",
      type: "number",
    } as Options,
    "gas-multiplier": {
      description: "Gas multiplier to be used for each transaction",
      type: "number",
    } as Options,
    "price-ids-process-chunk-size": {
      description:
        "Set in case we wanna split price feeds updates into chunks to have smaller transactions. Set to -1 to disable chunking.",
      type: "number",
      required: false,
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.mnemonicFile,
    ...options.pythContractAddress,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
    ...options.logLevel,
    ...options.controllerLogLevel,
  },
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
      priceIdsProcessChunkSize,
    } = argv;

    const logger = pino({ level: logLevel });

    if (network !== "testnet" && network !== "mainnet") {
      throw new Error("Please specify network. One of [testnet, mainnet]");
    }

    const priceConfigs = readPriceConfigFile(priceConfigFile);
    const hermesClient = new HermesClient(priceServiceEndpoint);
    const mnemonic = fs.readFileSync(mnemonicFile, "utf-8").trim();

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

    const injectiveListener = new InjectivePriceListener(
      pythContractAddress,
      grpcEndpoint,
      priceItems,
      logger.child({ module: "InjectivePriceListener" }),
      {
        pollingFrequency,
      },
    );
    const injectivePusher = new InjectivePricePusher(
      hermesClient,
      pythContractAddress,
      grpcEndpoint,
      logger.child({ module: "InjectivePricePusher" }),
      mnemonic,
      {
        chainId: getNetworkInfo(network).chainId,
        gasPrice,
        gasMultiplier,
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

    controller.start();
  },
};
