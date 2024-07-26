import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import fs from "fs";
import { PythPriceListener } from "../pyth-price-listener";
import { Controller } from "../controller";
import { Options } from "yargs";
import { SuiPriceListener, SuiPricePusher } from "./sui";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import pino from "pino";

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
    "pyth-state-id": {
      description:
        "Pyth State Id. Can be found here" +
        "https://docs.pyth.network/documentation/pythnet-price-feeds/sui",
      type: "string",
      required: true,
    } as Options,
    "wormhole-state-id": {
      description:
        "Wormhole State Id. Can be found here" +
        "https://docs.pyth.network/documentation/pythnet-price-feeds/sui",
      type: "string",
      required: true,
    } as Options,
    "num-gas-objects": {
      description: "Number of gas objects in the pool.",
      type: "number",
      required: true,
      default: 30,
    } as Options,
    "ignore-gas-objects": {
      description:
        "Gas objects to ignore when merging gas objects on startup -- use this for locked objects.",
      type: "array",
      required: false,
      default: [],
    } as Options,
    "gas-budget": {
      description: "Gas budget for each price update",
      type: "number",
      required: true,
      default: 500_000_000,
    } as Options,
    "account-index": {
      description: "Index of the account to use derived by the mnemonic",
      type: "number",
      required: true,
      default: 0,
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.mnemonicFile,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
    ...options.logLevel,
    ...options.priceServiceConnectionLogLevel,
    ...options.controllerLogLevel,
  },
  handler: async function (argv: any) {
    const {
      endpoint,
      priceConfigFile,
      priceServiceEndpoint,
      mnemonicFile,
      pushingFrequency,
      pollingFrequency,
      pythStateId,
      wormholeStateId,
      numGasObjects,
      ignoreGasObjects,
      gasBudget,
      accountIndex,
      logLevel,
      priceServiceConnectionLogLevel,
      controllerLogLevel,
    } = argv;

    const logger = pino({ level: logLevel });

    const priceConfigs = readPriceConfigFile(priceConfigFile);
    const priceServiceConnection = new PriceServiceConnection(
      priceServiceEndpoint,
      {
        logger: logger.child(
          { module: "PriceServiceConnection" },
          { level: priceServiceConnectionLogLevel }
        ),
        priceFeedRequestConfig: {
          binary: true,
        },
      }
    );
    const mnemonic = fs.readFileSync(mnemonicFile, "utf-8").trim();
    const keypair = Ed25519Keypair.deriveKeypair(
      mnemonic,
      `m/44'/784'/${accountIndex}'/0'/0'`
    );
    logger.info(
      `Pushing updates from wallet address: ${keypair
        .getPublicKey()
        .toSuiAddress()}`
    );

    const priceItems = priceConfigs.map(({ id, alias }) => ({ id, alias }));

    const pythListener = new PythPriceListener(
      priceServiceConnection,
      priceItems,
      logger.child({ module: "PythPriceListener" })
    );

    const suiListener = new SuiPriceListener(
      pythStateId,
      wormholeStateId,
      endpoint,
      priceItems,
      logger.child({ module: "SuiPriceListener" }),
      { pollingFrequency }
    );
    const suiPusher = await SuiPricePusher.createWithAutomaticGasPool(
      priceServiceConnection,
      logger.child({ module: "SuiPricePusher" }),
      pythStateId,
      wormholeStateId,
      endpoint,
      keypair,
      gasBudget,
      numGasObjects,
      ignoreGasObjects
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      suiListener,
      suiPusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      { pushingFrequency }
    );

    controller.start();
  },
};
