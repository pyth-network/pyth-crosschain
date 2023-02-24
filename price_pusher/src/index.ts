#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  EvmPriceServiceConnection,
  CONTRACT_ADDR,
} from "@pythnetwork/pyth-evm-js";
import { Pusher } from "./pusher";
import { EvmPriceListener } from "./evm-price-listener";
import { PythPriceListener } from "./pyth-price-listener";
import fs from "fs";
import { readPriceConfigFile } from "./price-config";
import { PythContractFactory } from "./pyth-contract-factory";

const argv = yargs(hideBin(process.argv))
  .option("evm-endpoint", {
    description:
      "RPC endpoint URL for the EVM network. If you provide a normal HTTP endpoint, the pusher " +
      "will periodically poll for updates. The polling interval is configurable via the " +
      "`evm-polling-frequency` command-line argument. If you provide a websocket RPC " +
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
  .option("evm-polling-frequency", {
    description:
      "The frequency to poll price info data from the EVM network if the RPC is not a websocket.",
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

async function run() {
  const connection = new EvmPriceServiceConnection(argv.priceEndpoint, {
    logger: console,
  });

  const pythContractFactory = new PythContractFactory(
    argv.evmEndpoint,
    fs.readFileSync(argv.mnemonicFile, "utf-8").trim(),
    pythContractAddr
  );

  const evmPriceListener = new EvmPriceListener(
    pythContractFactory,
    priceConfigs,
    {
      pollingFrequency: argv.evmPollingFrequency,
    }
  );

  const pythPriceListener = new PythPriceListener(connection, priceConfigs);

  const handler = new Pusher(
    connection,
    pythContractFactory,
    evmPriceListener,
    pythPriceListener,
    priceConfigs,
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

run();
