import { Options } from "yargs";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { PythPriceListener } from "../pyth-price-listener";
import { SolanaPriceListener, SolanaPricePusher } from "./solana";
import { Controller } from "../controller";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Keypair, Connection } from "@solana/web3.js";
import fs from "fs";

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

    const wallet = new NodeWallet(
      Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(keypairFile, "ascii")))
      )
    );

    const pythSolanaReceiver = new PythSolanaReceiver({
      connection: new Connection(endpoint),
      wallet,
    });

    const solanaPricePusher = new SolanaPricePusher(pythSolanaReceiver);
    const solanaPriceListener = new SolanaPriceListener(
      pythSolanaReceiver,
      priceItems,
      { pollingFrequency }
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
