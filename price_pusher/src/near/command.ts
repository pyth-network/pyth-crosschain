import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import { PythPriceListener } from "../pyth-price-listener";
import { Controller } from "../controller";
import { Options } from "yargs";
import { NearAccount, NearPriceListener, NearPricePusher } from "./near";


export default {
  command: "near",
  describe: "run price pusher for near",
  builder: {
    "node-url": {
      description: "NEAR RPC API url. used to make JSON RPC calls to interact with NEAR.",
      type: "string",
      required: true,
    } as Options,
    network: {
      description: "testnet or mainnet.",
      type: "string",
      required: true,
    } as Options,
    "account-id": {
      description: "payer account identifier.",
      type: "string",
      required: true,
    } as Options,
    "private-key-path": {
      description: "path to payer private key file.",
      type: "string",
      required: false,
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.pythContractAddress,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
  },
  handler: function (argv: any) {
    // FIXME: type checks for this
    const {
      nodeUrl,
      network,
      accountId,
      privateKeyPath,
      priceConfigFile,
      priceServiceEndpoint,
      pythContractAddress,
      pushingFrequency,
      pollingFrequency,
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

    const priceItems = priceConfigs.map(({ id, alias }) => ({ id, alias }));

    const pythListener = new PythPriceListener(
      priceServiceConnection,
      priceItems
    );

    const nearAccount = new NearAccount(
      network,
      accountId,
      nodeUrl,
      privateKeyPath,
      pythContractAddress
    );

    const nearListener = new NearPriceListener(
      nearAccount,
      priceItems,
      { pollingFrequency }
    );

    const nearPusher = new NearPricePusher(
      nearAccount,
      priceServiceConnection,
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      nearListener,
      nearPusher,
      { pushingFrequency }
    );

    controller.start();
  },
};
