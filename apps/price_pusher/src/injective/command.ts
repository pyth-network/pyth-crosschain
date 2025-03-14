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
      description: "Gas price to be used for each transasction",
      type: "number",
    } as Options,
    "gas-multiplier": {
      description: "Gas multiplier to be used for each transasction",
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
  },
  handler: async function (argv: any) {
    // FIXME: type checks for this
    const {
      gasPrice,
      gasMultiplier,
      grpcEndpoint,
      priceConfigFile,
      priceServiceEndpoint,
      mnemonicFile,
      pythContractAddress,
      pushingFrequency,
      pollingFrequency,
      network,
      logLevel,
      controllerLogLevel,
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
