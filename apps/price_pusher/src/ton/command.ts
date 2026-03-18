/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";

import { HermesClient } from "@pythnetwork/hermes-client";
import { Address, TonClient } from "@ton/ton";
import { pino } from "pino";
import type { Options } from "yargs";
import { Controller } from "../controller.js";
import type { IPriceListener } from "../interface.js";
import * as options from "../options.js";
import { readPriceConfigFile } from "../price-config.js";
import { PythPriceListener } from "../pyth-price-listener.js";
import { filterInvalidPriceItems } from "../utils.js";
import { TonPriceListener, TonPricePusher } from "./ton.js";

export default {
  builder: {
    endpoint: {
      description: "TON RPC API endpoint",
      required: true,
      type: "string",
    } as Options,
    "private-key-file": {
      description: "Path to the private key file",
      required: true,
      type: "string",
    } as Options,
    "pyth-contract-address": {
      description: "Pyth contract address on TON",
      required: true,
      type: "string",
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.pushingFrequency,
    ...options.pollingFrequency,
    ...options.logLevel,
    ...options.controllerLogLevel,
  },
  command: "ton",
  describe: "run price pusher for TON",
  // biome-ignore lint/suspicious/noExplicitAny: yargs handler requires any type for argv
  handler: async (argv: any) => {
    const {
      endpoint,
      privateKeyFile,
      pythContractAddress,
      priceConfigFile,
      priceServiceEndpoint,
      pushingFrequency,
      pollingFrequency,
      logLevel,
      controllerLogLevel,
    } = argv;

    const logger = pino({ level: logLevel });

    const priceConfigs = readPriceConfigFile(priceConfigFile);

    const hermesClient = new HermesClient(priceServiceEndpoint);

    let priceItems = priceConfigs.map(({ id, alias }) => ({ alias, id }));

    // Better to filter out invalid price items before creating the pyth listener
    const { existingPriceItems, invalidPriceItems } =
      await filterInvalidPriceItems(hermesClient, priceItems);

    if (invalidPriceItems.length > 0) {
      logger.error(
        `Invalid price id submitted for: ${invalidPriceItems
          .map(({ alias }) => alias)
          .join(", ")}`,
      );
    }

    priceItems = existingPriceItems;

    const pythListener = new PythPriceListener(
      hermesClient,
      priceItems,
      logger.child({ module: "PythPriceListener" }),
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
      { pollingFrequency },
    );

    const tonPricePusher = new TonPricePusher(
      client,
      privateKey,
      contractAddress,
      hermesClient,
      logger.child({ module: "TonPricePusher" }),
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      // TODO: This is very unsafe, but matches existing behavior with looser types
      tonPriceListener as unknown as IPriceListener,
      tonPricePusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      { pushingFrequency },
    );

    void controller.start();
  },
};
