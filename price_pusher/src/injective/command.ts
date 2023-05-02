import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import fs from "fs";
import { InjectivePriceListener, InjectivePricePusher } from "./injective";
import { PythPriceListener } from "../pyth-price-listener";
import { Controller } from "../controller";
import { Options } from "yargs";
import { getNetworkInfo } from "@injectivelabs/networks";

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
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.mnemonicFile,
    ...options.pythContractAddress,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
  },
  handler: function (argv: any) {
    // FIXME: type checks for this
    const {
      grpcEndpoint,
      priceConfigFile,
      priceServiceEndpoint,
      mnemonicFile,
      pythContractAddress,
      pushingFrequency,
      pollingFrequency,
      network,
    } = argv;

    if (network !== "testnet" && network !== "mainnet") {
      throw new Error("Please specify network. One of [testnet, mainnet]");
    }

    const priceConfigs = readPriceConfigFile(priceConfigFile);
    const priceServiceConnection = new PriceServiceConnection(
      priceServiceEndpoint,
      {
        logger: {
          // Log only warnings and errors from the price service client
          info: () => undefined,
          warn: console.warn,
          error: console.error,
          debug: () => undefined,
          trace: () => undefined,
        },
      }
    );
    const mnemonic = fs.readFileSync(mnemonicFile, "utf-8").trim();

    const priceItems = priceConfigs.map(({ id, alias }) => ({ id, alias }));

    const pythListener = new PythPriceListener(
      priceServiceConnection,
      priceItems
    );

    const injectiveListener = new InjectivePriceListener(
      pythContractAddress,
      grpcEndpoint,
      priceItems,
      {
        pollingFrequency,
      }
    );
    const injectivePusher = new InjectivePricePusher(
      priceServiceConnection,
      pythContractAddress,
      grpcEndpoint,
      mnemonic,
      {
        chainId: getNetworkInfo(network).chainId,
      }
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      injectiveListener,
      injectivePusher,
      { pushingFrequency }
    );

    controller.start();
  },
};
