#!/usr/bin/env node
// FIXME: refactor this file and command structure
// FIXME: update readme and compose files
// FIXME: release a new version
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  EvmPriceServiceConnection,
  CONTRACT_ADDR,
} from "@pythnetwork/pyth-evm-js";
import { Controller } from "./controller";
import { EvmPriceListener, EvmPricePusher, PythContractFactory } from "./evm";
import { PythPriceListener } from "./pyth-price-listener";
import fs from "fs";
import { readPriceConfigFile } from "./price-config";
import { PriceServiceConnection } from "@pythnetwork/pyth-common-js";
import {
  CwPriceServiceConnection,
  InjectivePriceListener,
  InjectivePricePusher,
} from "./injective";

const argv = yargs(hideBin(process.argv))
  .option("network", {
    description: "the blockchain network to push to",
    type: "string",
    choices: ["evm", "injective"],
    required: true,
  })
  .option("endpoint", {
    description:
      "RPC endpoint URL for the network. If you provide a normal HTTP endpoint, the pusher " +
      "will periodically poll for updates. The polling interval is configurable via the " +
      "`polling-frequency` command-line argument. for the evm chains, if you provide a websocket RPC " +
      "endpoint (`ws[s]://...`), the price pusher will use event subscriptions to read " +
      "the current EVM price in addition to polling. ",
    type: "string",
    required: true,
  })
  .option("price-endpoint", {
    description:
      "Endpoint URL for the price service. e.g: https://endpoint/example",
    type: "string",
    required: true,
  })
  .option("pyth-contract", {
    description:
      "Pyth contract address. Provide the network name on which Pyth is deployed " +
      "or the Pyth contract address if you use a local network.",
    type: "string",
    required: true,
  })
  .option("price-config-file", {
    description: "Path to price configuration YAML file.",
    type: "string",
    required: true,
  })
  .option("mnemonic-file", {
    description: "Path to payer mnemonic (private key) file.",
    type: "string",
    required: true,
  })
  .option("cooldown-duration", {
    description:
      "The amount of time (in seconds) to wait between pushing price updates. " +
      "This value should be greater than the block time of the network, so this program confirms " +
      "it is updated and does not push it twice.",
    type: "number",
    required: false,
    default: 10,
  })
  .option("polling-frequency", {
    description:
      "The frequency to poll price info data from the network if the RPC is not a websocket.",
    type: "number",
    required: false,
    default: 5,
  })
  .help()
  .alias("help", "h")
  .parserConfiguration({
    "parse-numbers": false,
  })
  .parseSync();

let pythContractAddr: string;

if (CONTRACT_ADDR[argv.pythContract] !== undefined) {
  pythContractAddr = CONTRACT_ADDR[argv.pythContract];
} else {
  pythContractAddr = argv.pythContract;
}

const priceConfigs = readPriceConfigFile(argv.priceConfigFile);

async function injectiveRun() {
  const connection = new PriceServiceConnection(argv.priceEndpoint, {
    logger: console,
  });

  const pythPriceListener = new PythPriceListener(connection, priceConfigs);

  const injectivePriceListener = new InjectivePriceListener(
    pythContractAddr,
    argv.endpoint,
    priceConfigs,
    { pollingFrequency: argv.pollingFrequency }
  );

  const injectivePricePusher = new InjectivePricePusher(
    new CwPriceServiceConnection(argv.priceEndpoint, {
      logger: console,
    }),
    argv.pythContract,
    argv.endpoint,
    fs.readFileSync(argv.mnemonicFile, "utf-8").trim()
  );

  const handler = new Controller(
    priceConfigs,
    pythPriceListener,
    injectivePriceListener,
    injectivePricePusher,
    {
      cooldownDuration: argv.cooldownDuration,
    }
  );

  await injectivePriceListener.start();
  await pythPriceListener.start();

  // Handler starts after the above listeners are started
  // which means that they have fetched their initial price information.
  await handler.start();
}

async function evmRun() {
  const connection = new EvmPriceServiceConnection(argv.priceEndpoint, {
    logger: console,
  });

  const pythContractFactory = new PythContractFactory(
    argv.endpoint,
    fs.readFileSync(argv.mnemonicFile, "utf-8").trim(),
    pythContractAddr
  );

  const evmPriceListener = new EvmPriceListener(
    pythContractFactory,
    priceConfigs,
    {
      pollingFrequency: argv.pollingFrequency,
    }
  );

  const pythPriceListener = new PythPriceListener(connection, priceConfigs);

  const evmPricePusher = new EvmPricePusher(
    connection,
    pythContractFactory.createPythContractWithPayer()
  );

  const handler = new Controller(
    priceConfigs,
    pythPriceListener,
    evmPriceListener,
    evmPricePusher,
    {
      cooldownDuration: argv.cooldownDuration,
    }
  );

  await evmPriceListener.start();
  await pythPriceListener.start();

  // Handler starts after the above listeners are started
  // which means that they have fetched their initial price information.
  await handler.start();
}

function run() {
  if (argv.network === "injective") injectiveRun();
  else if (argv.network === "evm") evmRun();
}

run();
