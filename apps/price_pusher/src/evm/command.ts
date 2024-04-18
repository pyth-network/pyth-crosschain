import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import fs from "fs";
import { PythPriceListener } from "../pyth-price-listener";
import { Controller } from "../controller";
import { Options } from "yargs";
import { EvmPriceListener, EvmPricePusher, PythContractFactory } from "./evm";
import { getCustomGasStation } from "./custom-gas-station";

export default {
  command: "evm",
  describe: "run price pusher for evm",
  builder: {
    endpoint: {
      description:
        "RPC endpoint URL for evm network. If you provide a normal HTTP endpoint, the pusher " +
        "will periodically poll for updates. The polling interval is configurable via the " +
        "`polling-frequency` command-line argument. If you provide a websocket RPC " +
        "endpoint (`ws[s]://...`), the price pusher will use event subscriptions to read " +
        "the current EVM price in addition to polling. ",
      type: "string",
      required: true,
    } as Options,
    "custom-gas-station": {
      description:
        "If using a custom gas station, chainId of custom gas station to use",
      type: "number",
      required: false,
    } as Options,
    "tx-speed": {
      description:
        "txSpeed for custom gas station. choose between 'slow'|'standard'|'fast'",
      choices: ["slow", "standard", "fast"],
      required: false,
    } as Options,
    "override-gas-price-multiplier": {
      description:
        "Multiply the previous gas price by this number if the transaction is not landing to override. " +
        "Please note that the gas price can grow exponentially on consecutive failures; " +
        "to set a cap on the multiplier, use the `override-gas-price-multiplier-cap` option." +
        "Default to 1.1",
      type: "number",
      required: false,
      default: 1.1,
    } as Options,
    "override-gas-price-multiplier-cap": {
      description:
        "Maximum gas price multiplier to use in override compared to the RPC returned " +
        "gas price. Default to 5",
      type: "number",
      required: false,
      default: 5,
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
      customGasStation,
      txSpeed,
      overrideGasPriceMultiplier,
      overrideGasPriceMultiplierCap,
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

    const pythContractFactory = new PythContractFactory(
      endpoint,
      mnemonic,
      pythContractAddress
    );
    console.log(
      `Pushing updates from wallet address: ${pythContractFactory
        .createWeb3PayerProvider()
        .getAddress()}`
    );

    const evmListener = new EvmPriceListener(pythContractFactory, priceItems, {
      pollingFrequency,
    });

    const gasStation = getCustomGasStation(customGasStation, txSpeed);
    const evmPusher = new EvmPricePusher(
      priceServiceConnection,
      pythContractFactory,
      overrideGasPriceMultiplier,
      overrideGasPriceMultiplierCap,
      gasStation
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      evmListener,
      evmPusher,
      { pushingFrequency }
    );

    controller.start();
  },
};
