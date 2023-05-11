import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import fs from "fs";
import { PythPriceListener } from "../pyth-price-listener";
import { Controller } from "../controller";
import { Options } from "yargs";
import { AptosPriceListener, AptosPricePusher } from "./aptos";

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
  },
  handler: function (argv: any) {
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
    } = argv;

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

    // create aptos listerer and pusher
    const aptosListener = new AptosPriceListener(
      pythContractAddress,
      endpoint,
      priceItems,
      { pollingFrequency }
    );
    const aptosPusher = new AptosPricePusher(
      priceServiceConnection,
      pythContractAddress,
      endpoint,
      mnemonic,
      overrideGasPriceMultiplier
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      aptosListener,
      aptosPusher,
      { pushingFrequency }
    );

    controller.start();
  },
};
