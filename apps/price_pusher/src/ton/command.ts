import { Options } from "yargs";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { PythPriceListener } from "../pyth-price-listener";
import { TonPriceListener, TonPricePusher } from "./ton";
import { Controller } from "../controller";
import { Address, TonClient } from "@ton/ton";
import fs from "fs";
import pino from "pino";

export default {
  command: "ton",
  describe: "run price pusher for TON",
  builder: {
    endpoint: {
      description: "TON RPC API endpoint",
      type: "string",
      required: true,
    } as Options,
    "private-key-file": {
      description: "Path to the private key file",
      type: "string",
      required: true,
    } as Options,
    "pyth-contract-address": {
      description: "Pyth contract address on TON",
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

    const client = new TonClient({ endpoint });
    const privateKey = fs.readFileSync(privateKeyFile, "utf8").trim();
    const contractAddress = Address.parse(pythContractAddress);
    const provider = client.provider(contractAddress);

    const tonPriceListener = new TonPriceListener(
      provider,
      contractAddress,
      priceItems,
      logger.child({ module: "TonPriceListener" }),
      { pollingFrequency }
    );

    const tonPricePusher = new TonPricePusher(
      client,
      privateKey,
      contractAddress,
      priceServiceConnection,
      logger.child({ module: "TonPricePusher" })
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      tonPriceListener,
      tonPricePusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      { pushingFrequency }
    );

    await controller.start();
  },
};
