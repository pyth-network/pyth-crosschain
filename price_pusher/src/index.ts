#!/usr/bin/env node
// FIXME: refactor this file and command structure
// FIXME: update readme and compose files
// FIXME: release a new version
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Controller } from "./controller";
import { EvmPriceListener, EvmPricePusher, PythContractFactory } from "./evm";
import { PythPriceListener } from "./pyth-price-listener";
import fs from "fs";
import { readPriceConfigFile } from "./price-config";
import { PriceServiceConnection } from "@pythnetwork/pyth-common-js";
import { InjectivePriceListener, InjectivePricePusher } from "./injective";
import { ChainPricePusher, IPriceListener } from "./interface";
import { CustomGasStation } from "./custom-gas-station";

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
      "`polling-frequency` command-line argument. For the evm chains, if you provide a websocket RPC " +
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
  .option("custom-gas-station", {
    description:
      "If using a custom gas station, chainId of custom gas station to use",
    type: "number",
    required: false,
  })
  .option("tx-speed", {
    description:
      "txSpeed for custom gas station. choose between 'slow'|'standard'|'fast'",
    type: "string",
    required: false,
  })
  .help()
  .alias("help", "h")
  .parserConfiguration({
    "parse-numbers": false,
  })
  .parseSync();

const priceConfigs = readPriceConfigFile(argv.priceConfigFile);
const priceItems = priceConfigs.map(({ id, alias }) => ({ id, alias }));

// TODO: name ChainPricePusher -> IPricePusher in a clean up PR
// TODO: update listeners to not depend on the whole priceConfig
async function start({
  sourcePriceListener,
  targetPriceListener,
  targetPricePusher,
}: {
  sourcePriceListener: IPriceListener;
  targetPriceListener: IPriceListener;
  targetPricePusher: ChainPricePusher;
}) {
  const handler = new Controller(
    priceConfigs,
    sourcePriceListener,
    targetPriceListener,
    targetPricePusher,
    {
      cooldownDuration: argv.cooldownDuration,
    }
  );

  await handler.start();
}

const priceServiceConnection = new PriceServiceConnection(argv.priceEndpoint, {
  logger: console,
});

const pythPriceListener = new PythPriceListener(
  priceServiceConnection,
  priceConfigs
);

function getNetworkPriceListener(network: string): IPriceListener {
  switch (network) {
    case "evm": {
      const pythContractFactory = new PythContractFactory(
        argv.endpoint,
        fs.readFileSync(argv.mnemonicFile, "utf-8").trim(),
        argv.pythContract
      );

      return new EvmPriceListener(pythContractFactory, priceItems, {
        pollingFrequency: argv.pollingFrequency,
      });
    }

    case "injective":
      return new InjectivePriceListener(
        argv.pythContract,
        argv.endpoint,
        priceItems,
        { pollingFrequency: argv.pollingFrequency }
      );
    default:
      throw new Error("invalid network");
  }
}

function getNetworkPricePusher(network: string): ChainPricePusher {
  const gasStation = getCustomGasStation(argv.customGasStation, argv.txSpeed);
  switch (network) {
    case "evm": {
      const pythContractFactory = new PythContractFactory(
        argv.endpoint,
        fs.readFileSync(argv.mnemonicFile, "utf-8").trim(),
        argv.pythContract
      );
      return new EvmPricePusher(
        priceServiceConnection,
        pythContractFactory.createPythContractWithPayer(),
        gasStation
      );
    }
    case "injective":
      return new InjectivePricePusher(
        priceServiceConnection,
        argv.pythContract,
        argv.endpoint,
        fs.readFileSync(argv.mnemonicFile, "utf-8").trim()
      );
    default:
      throw new Error("invalid network");
  }
}

function getCustomGasStation(customGasStation?: number, txSpeed?: string) {
  if (customGasStation && txSpeed) {
    return new CustomGasStation(customGasStation, txSpeed);
  }
}

start({
  sourcePriceListener: pythPriceListener,
  targetPriceListener: getNetworkPriceListener(argv.network),
  targetPricePusher: getNetworkPricePusher(argv.network),
});
