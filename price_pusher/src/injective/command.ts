import { PriceServiceConnection } from "@pythnetwork/pyth-common-js";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import fs from "fs";
import { InjectivePriceListener, InjectivePricePusher } from "./injective";
import { PythPriceListener } from "../pyth-price-listener";
import { Controller } from "../controller";
import { Options } from "yargs";

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
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.mnemonicFile,
    ...options.pythContractAddress,
    ...options.pollingFrequency,
    ...options.cooldownDuration,
  },
  handler: function (argv: any) {
    // FIXME: type checks for this
    const {
      grpcEndpoint,
      priceConfigFile,
      priceServiceEndpoint,
      mnemonicFile,
      pythContractAddress,
      cooldownDuration,
      pollingFrequency,
    } = argv;

    const priceConfigs = readPriceConfigFile(priceConfigFile);
    const priceServiceConnection = new PriceServiceConnection(
      priceServiceEndpoint,
      {
        logger: console,
      }
    );
    const mnemonic = fs.readFileSync(mnemonicFile, "utf-8").trim();

    const priceItems = priceConfigs.map(({ id, alias }) => ({ id, alias }));

    const pythListener = new PythPriceListener(
      priceServiceConnection,
      priceConfigs
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
      mnemonic
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      injectiveListener,
      injectivePusher,
      { cooldownDuration }
    );

    controller.start();
  },
};
