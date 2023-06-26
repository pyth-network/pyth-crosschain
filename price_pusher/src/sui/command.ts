import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import fs from "fs";
import { PythPriceListener } from "../pyth-price-listener";
import { Controller } from "../controller";
import { Options } from "yargs";
import { SuiPriceListener, SuiPricePusher } from "./sui";
import { Ed25519Keypair } from "@mysten/sui.js";

export default {
  command: "sui",
  describe:
    "Run price pusher for sui. Most of the arguments below are" +
    "network specific, so there's one set of values for mainnet and" +
    "another for testnet. See config.sui..sample.json for the " +
    "appropriate values for your network. ",
  builder: {
    endpoint: {
      description:
        "RPC endpoint URL for sui. The pusher will periodically" +
        "poll for updates. The polling interval is configurable via the " +
        "`polling-frequency` command-line argument.",
      type: "string",
      required: true,
    } as Options,
    "pyth-package-id": {
      description:
        "Pyth Package Id. Can be found here" +
        "https://docs.pyth.network/pythnet-price-feeds/sui",
      type: "string",
      required: true,
    } as Options,
    "pyth-state-id": {
      description:
        "Pyth State Id. Can be found here" +
        "https://docs.pyth.network/pythnet-price-feeds/sui",
      type: "string",
      required: true,
    } as Options,
    "wormhole-package-id": {
      description:
        "Wormhole Package Id. Can be found here" +
        "https://docs.pyth.network/pythnet-price-feeds/sui",
      type: "string",
      required: true,
    } as Options,
    "wormhole-state-id": {
      description:
        "Wormhole State Id. Can be found here" +
        "https://docs.pyth.network/pythnet-price-feeds/sui",
      type: "string",
      required: true,
    } as Options,
    "price-feed-to-price-info-object-table-id": {
      description:
        "This is the id of the table which stored the information related to price data. You can find it here: " +
        "https://docs.pyth.network/pythnet-price-feeds/sui",
      type: "string",
      required: true,
    } as Options,
    "max-vaas-per-ptb": {
      description:
        "Maximum number of VAAs that can be included in a single PTB.",
      type: "number",
      required: true,
      default: 1,
    } as Options,
    "num-gas-objects": {
      description: "Number of gas objects in the pool.",
      type: "number",
      required: true,
      default: 30,
    } as Options,
    "gas-budget": {
      description: "Gas budget for each price update",
      type: "number",
      required: true,
      default: 500_000_000,
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.mnemonicFile,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
  },
  handler: async function (argv: any) {
    const {
      endpoint,
      priceConfigFile,
      priceServiceEndpoint,
      mnemonicFile,
      pushingFrequency,
      pollingFrequency,
      pythPackageId,
      pythStateId,
      wormholePackageId,
      wormholeStateId,
      priceFeedToPriceInfoObjectTableId,
      maxVaasPerPtb,
      numGasObjects,
      gasBudget,
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
        priceFeedRequestConfig: {
          binary: true,
        },
      }
    );
    const mnemonic = fs.readFileSync(mnemonicFile, "utf-8").trim();
    console.log(
      `Pushing updates from wallet address: ${Ed25519Keypair.deriveKeypair(
        mnemonic
      )
        .getPublicKey()
        .toSuiAddress()}`
    );

    const priceItems = priceConfigs.map(({ id, alias }) => ({ id, alias }));

    const pythListener = new PythPriceListener(
      priceServiceConnection,
      priceItems
    );

    const suiListener = new SuiPriceListener(
      pythPackageId,
      priceFeedToPriceInfoObjectTableId,
      endpoint,
      priceItems,
      { pollingFrequency }
    );
    const suiPusher = await SuiPricePusher.createWithAutomaticGasPool(
      priceServiceConnection,
      pythPackageId,
      pythStateId,
      wormholePackageId,
      wormholeStateId,
      priceFeedToPriceInfoObjectTableId,
      maxVaasPerPtb,
      endpoint,
      mnemonic,
      gasBudget,
      numGasObjects,
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      suiListener,
      suiPusher,
      { pushingFrequency }
    );

    controller.start();
  },
};
