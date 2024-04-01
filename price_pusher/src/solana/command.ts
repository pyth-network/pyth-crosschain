import { Options } from "yargs";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { PythPriceListener } from "../pyth-price-listener";
import { SolanaPriceListener, SolanaPricePusher } from "./solana";
import { Controller } from "../controller";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { KeyPair } from "near-api-js";

export default {
  command: "solana",
  describe: "run price pusher for solana",
  builder: {
    endpoint: {
      description: "Solana RPC API endpoint",
      type: "string",
      required: true,
    } as Options,
    "keypair-file": {
      description: "Path to keypair file",
      type: "string",
      required: true,
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.pythContractAddress,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
  },
  handler: function (argv: any) {
    const {
      endpoint,
      keypairFile,
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

    // const pythSolanaReceiver = new PythSolanaReceiver(
    //     {connection : new Connection(endpoint),
    //     keypair : }
    // )

    const solanaPricePusher = new SolanaPricePusher();
    const solanaPriceListener = new SolanaPriceListener(
      "solana",
      pollingFrequency,
      priceItems
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      solanaPriceListener,
      solanaPricePusher,
      { pushingFrequency }
    );

    controller.start();
  },
};
