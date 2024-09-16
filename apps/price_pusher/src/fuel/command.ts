import { Options } from "yargs";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { PythPriceListener } from "../pyth-price-listener";
import { FuelPriceListener, FuelPricePusher } from "./fuel";
import { Controller } from "../controller";
import { Provider, Wallet } from "fuels";
import fs from "fs";
import pino from "pino";

export default {
  command: "fuel",
  describe: "run price pusher for Fuel",
  builder: {
    endpoint: {
      description: "Fuel RPC API endpoint",
      type: "string",
      required: true,
    } as Options,
    "private-key-file": {
      description: "Path to the private key file",
      type: "string",
      required: true,
    } as Options,
    "pyth-contract-address": {
      description: "Pyth contract address on Fuel",
      type: "string",
      required: true,
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.pushingFrequency,
    ...options.pollingFrequency,
    ...options.logLevel,
    ...options.priceServiceConnectionLogLevel,
    ...options.controllerLogLevel,
  },
  handler: async function (argv: any) {
    const {
      endpoint,
      privateKeyFile,
      pythContractAddress,
      priceConfigFile,
      priceServiceEndpoint,
      pushingFrequency,
      pollingFrequency,
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
      }
    );

    const priceItems = priceConfigs.map(({ id, alias }) => ({ id, alias }));

    const pythListener = new PythPriceListener(
      priceServiceConnection,
      priceItems,
      logger.child({ module: "PythPriceListener" })
    );

    const provider = await Provider.create(endpoint);
    const privateKey = fs.readFileSync(privateKeyFile, "utf8").trim();
    const wallet = Wallet.fromPrivateKey(privateKey, provider);

    const fuelPriceListener = new FuelPriceListener(
      provider,
      pythContractAddress,
      priceItems,
      logger.child({ module: "FuelPriceListener" }),
      { pollingFrequency }
    );

    const fuelPricePusher = new FuelPricePusher(
      wallet,
      pythContractAddress,
      priceServiceConnection,
      logger.child({ module: "FuelPricePusher" })
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      fuelPriceListener,
      fuelPricePusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      { pushingFrequency }
    );

    await controller.start();
  },
};
