import { Options } from "yargs";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { PythPriceListener } from "../pyth-price-listener";
import {
  SolanaPriceListener,
  SolanaPricePusher,
  SolanaPricePusherJito,
} from "./solana";
import { Controller } from "../controller";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { Keypair, Connection } from "@solana/web3.js";
import fs from "fs";
import { PublicKey } from "@solana/web3.js";
import {
  SearcherClient,
  searcherClient,
} from "jito-ts/dist/sdk/block-engine/searcher";
import express from 'express';
import { DriftClient } from "@drift-labs/sdk";

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
      description: "Path to a keypair file",
      type: "string",
      required: true,
    } as Options,
    "compute-unit-price-micro-lamports": {
      description: "Priority fee per compute unit",
      type: "number",
      default: 50000,
    } as Options,
    "jito-endpoint": {
      description: "Jito endpoint",
      type: "string",
      optional: true,
    } as Options,
    "jito-keypair-file": {
      description:
        "Path to the jito keypair file (need for grpc authentication)",
      type: "string",
      optional: true,
    } as Options,
    "jito-tip-lamports": {
      description: "Lamports to tip the jito builder",
      type: "number",
      optional: true,
    } as Options,
    "jito-bundle-size": {
      description: "Number of transactions in each bundle",
      type: "number",
      default: 2,
    } as Options,
    "address-lookup-table-pubkey": {
      description: "Look up table for solana accounts",
      type: "string",
      optional: false,
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
  },
  handler: async function (argv: any) {
    const {
      endpoint,
      keypairFile,
      computeUnitPriceMicroLamports,
      priceConfigFile,
      priceServiceEndpoint,
      pushingFrequency,
      pollingFrequency,
      jitoEndpoint,
      jitoKeypairFile,
      jitoTipLamports,
      jitoBundleSize,
      addressLookupTablePubkey
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
      loadKeypair(fs.readFileSync(keypairFile, "ascii"))
    );

    const driftClient = new DriftClient({
      connection: new Connection(endpoint, "processed"),
      wallet,
    });

    let solanaPricePusher;
    if (jitoTipLamports) {
      const jitoKeypair = loadKeypair(fs.readFileSync(jitoKeypairFile, "ascii"));

      const jitoClient = searcherClient(jitoEndpoint, jitoKeypair);
      solanaPricePusher = new SolanaPricePusherJito(
        driftClient,
        priceServiceConnection,
        jitoTipLamports,
        jitoBundleSize,
        addressLookupTablePubkey
      );

      onBundleResult(jitoClient);
    } else {
      const addressLookupTable = (await driftClient.connection.getAddressLookupTable(
        new PublicKey(addressLookupTablePubkey)
      )).value!;
      solanaPricePusher = new SolanaPricePusher(
        driftClient,
        priceServiceConnection,
        computeUnitPriceMicroLamports,
        addressLookupTable
      );
    }

    const solanaPriceListener = new SolanaPriceListener(
      driftClient,
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

    startServer(controller);
  },
};

export const onBundleResult = (c: SearcherClient) => {
  c.onBundleResult(
    () => undefined,
    (e) => {
      console.log("Error in bundle result: ", e);
    }
  );
};

export function loadKeypair(privateKey: string): Keypair {
	// try to load privateKey as a filepath
	let loadedKey: Uint8Array;
	if (fs.existsSync(privateKey)) {
		privateKey = fs.readFileSync(privateKey).toString();
	}

	if (privateKey.includes('[') && privateKey.includes(']')) {
		loadedKey = Uint8Array.from(JSON.parse(privateKey));
	} else {
		loadedKey = Uint8Array.from(
			privateKey.split(',').map((val) => Number(val))
		);
	}

	return Keypair.fromSecretKey(Uint8Array.from(loadedKey));
}

function startServer(controller: Controller): void {
  const app = express();

  app.get('/startup', (_req, res) => {
    res.writeHead(200);
    res.end('OK');
  });

  app.get('/health', (_req, res) => {      
    controller.handleHealthCheck()(_req, res);
  });

  app.listen(8080, () => {
    console.log('Health server is running on port 8080');
  });
}
