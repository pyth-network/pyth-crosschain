/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { HermesClient } from "@pythnetwork/hermes-client";
import { pino } from "pino";
import type { Options } from "yargs";

import { Controller } from "../controller";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import { PythPriceListener } from "../pyth-price-listener";
import { filterInvalidPriceItems } from "../utils";
import { NearAccount, NearPriceListener, NearPricePusher } from "./near";

export default {
  builder: {
    "account-id": {
      description: "payer account identifier.",
      required: true,
      type: "string",
    } as Options,
    network: {
      description: "testnet or mainnet.",
      required: true,
      type: "string",
    } as Options,
    "node-url": {
      description:
        "NEAR RPC API url. used to make JSON RPC calls to interact with NEAR.",
      required: true,
      type: "string",
    } as Options,
    "private-key-path": {
      description: "path to payer private key file.",
      required: false,
      type: "string",
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.pythContractAddress,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
    ...options.logLevel,
    ...options.controllerLogLevel,
  },
  command: "near",
  describe: "run price pusher for near",
  // biome-ignore lint/suspicious/noExplicitAny: yargs handler requires any type for argv
  handler: async (argv: any) => {
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
      logger,
    );

    const nearAccount = new NearAccount(
      network,
      accountId,
      nodeUrl,
      privateKeyPath,
      pythContractAddress,
    );

    const nearListener = new NearPriceListener(
      nearAccount,
      priceItems,
      logger.child({ module: "NearPriceListener" }),
      {
        pollingFrequency,
      },
    );

    const nearPusher = new NearPricePusher(
      nearAccount,
      hermesClient,
      logger.child({ module: "NearPricePusher" }),
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      nearListener,
      nearPusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      { pushingFrequency },
    );

    void controller.start();
  },
};
