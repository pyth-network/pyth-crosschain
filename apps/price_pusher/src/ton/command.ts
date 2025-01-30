import { Options } from "yargs";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import { PythPriceListener } from "../pyth-price-listener";
import { TonPriceListener, TonPricePusher } from "./ton";
import { Controller } from "../controller";
import { Address, TonClient } from "@ton/ton";
import fs from "fs";
import pino from "pino";
import { HermesClient } from "@pythnetwork/hermes-client";

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
    ...options.hermesEndpoint,
    ...options.pushingFrequency,
    ...options.pollingFrequency,
    ...options.logLevel,
    ...options.controllerLogLevel,
  },
  handler: async function (argv: any) {
    const {
      endpoint,
      privateKeyFile,
      pythContractAddress,
      priceConfigFile,
      hermesEndpoint,
      pushingFrequency,
      pollingFrequency,
      logLevel,
      controllerLogLevel,
    } = argv;

    const logger = pino({ level: logLevel });

    const priceConfigs = readPriceConfigFile(priceConfigFile);

    const hermesClient = new HermesClient(hermesEndpoint);

    const priceItems = priceConfigs.map(({ id, alias }) => ({ id, alias }));

    const pythListener = new PythPriceListener(
      hermesClient,
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
      hermesClient,
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
