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
import { Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import fs from "fs";
import { PublicKey } from "@solana/web3.js";
import {
  SearcherClient,
  searcherClient,
} from "jito-ts/dist/sdk/block-engine/searcher";
import pino from "pino";
import { Logger } from "pino";

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
    "shard-id": {
      description: "Shard ID",
      type: "number",
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
    "dynamic-jito-tips": {
      description: "Use dynamic jito tips",
      type: "boolean",
      default: false,
    } as Options,
    "max-jito-tip-lamports": {
      description: "Maximum jito tip lamports",
      type: "number",
      default: LAMPORTS_PER_SOL / 100,
    } as Options,
    "jito-bundle-size": {
      description: "Number of transactions in each bundle",
      type: "number",
      default: 2,
    } as Options,
    "updates-per-jito-bundle": {
      description: "Number of transactions in each bundle",
      type: "number",
      default: 6,
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.pythContractAddress,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
    ...options.logLevel,
    ...options.priceServiceConnectionLogLevel,
    ...options.controllerLogLevel,
  },
  handler: function (argv: any) {
    const {
      endpoint,
      keypairFile,
      shardId,
      computeUnitPriceMicroLamports,
      priceConfigFile,
      priceServiceEndpoint,
      pythContractAddress,
      pushingFrequency,
      pollingFrequency,
      jitoEndpoint,
      jitoKeypairFile,
      jitoTipLamports,
      dynamicJitoTips,
      maxJitoTipLamports,
      jitoBundleSize,
      updatesPerJitoBundle,
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

    const wallet = new NodeWallet(
      Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(keypairFile, "ascii")))
      )
    );

    const pythSolanaReceiver = new PythSolanaReceiver({
      connection: new Connection(endpoint, "processed"),
      wallet,
      pushOracleProgramId: new PublicKey(pythContractAddress),
    });

    let solanaPricePusher;
    if (jitoTipLamports) {
      const jitoKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(jitoKeypairFile, "ascii")))
      );

      const jitoClient = searcherClient(jitoEndpoint, jitoKeypair);
      solanaPricePusher = new SolanaPricePusherJito(
        pythSolanaReceiver,
        priceServiceConnection,
        logger.child({ module: "SolanaPricePusherJito" }),
        shardId,
        jitoTipLamports,
        dynamicJitoTips,
        maxJitoTipLamports,
        jitoClient,
        jitoBundleSize,
        updatesPerJitoBundle
      );

      onBundleResult(jitoClient, logger.child({ module: "JitoClient" }));
    } else {
      solanaPricePusher = new SolanaPricePusher(
        pythSolanaReceiver,
        priceServiceConnection,
        logger.child({ module: "SolanaPricePusher" }),
        shardId,
        computeUnitPriceMicroLamports
      );
    }

    const solanaPriceListener = new SolanaPriceListener(
      pythSolanaReceiver,
      shardId,
      priceItems,
      logger.child({ module: "SolanaPriceListener" }),
      { pollingFrequency }
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      solanaPriceListener,
      solanaPricePusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      { pushingFrequency }
    );

    controller.start();
  },
};

export const onBundleResult = (c: SearcherClient, logger: Logger) => {
  c.onBundleResult(
    () => undefined,
    (err) => {
      logger.error(err, "Error in bundle result");
    }
  );
};
