#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import YAML from "yaml";
import fs from "fs";
import pino, { Logger } from "pino";
import { DefaultStore } from "@pythnetwork/contract-manager/node/store";
import { EvmEntropyContract } from "@pythnetwork/contract-manager/core/contracts/evm";
import {
  PrivateKey,
  toPrivateKey,
} from "@pythnetwork/contract-manager/core/base";

type DurationSeconds = number;
type LoadedConfig = {
  contract: EvmEntropyContract;
  interval: DurationSeconds;
};

function timeToSeconds(timeStr: string): number {
  const match = timeStr.match(/^(\d+)([hms])$/i);
  if (!match)
    throw new Error("Invalid format. Use formats like '6h', '15m', or '30s'.");

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "h":
      return value * 3600;
    case "m":
      return value * 60;
    case "s":
      return value;
    default:
      throw new Error("Unsupported time unit.");
  }
}

function loadConfig(configPath: string): LoadedConfig[] {
  const configs = YAML.parse(fs.readFileSync(configPath, "utf-8"));
  const loadedConfigs = [];
  for (const config of configs) {
    const interval = timeToSeconds(config["interval"]);
    const contracts = Object.values(DefaultStore.entropy_contracts).filter(
      (contract) => contract.chain.getId() == config["chain-id"],
    );
    if (contracts.length === 0) {
      throw new Error(
        `Can not find the contract for chain ${config["chain-id"]}, check contract manager store.`,
      );
    }
    if (contracts.length > 1) {
      throw new Error(
        `Multiple contracts found for chain ${config["chain-id"]}, check contract manager store.`,
      );
    }
    loadedConfigs.push({ contract: contracts[0], interval });
  }
  return loadedConfigs;
}

async function testLatency(
  contract: EvmEntropyContract,
  privateKey: PrivateKey,
  logger: Logger,
) {
  const provider = await contract.getDefaultProvider();
  const userRandomNumber = contract.generateUserRandomNumber();
  const requestResponse = await contract.requestRandomness(
    userRandomNumber,
    provider,
    privateKey,
    true, // with callback
  );
  // Read the sequence number for the request from the transaction events.
  const sequenceNumber = parseInt(
    requestResponse.events.RequestedWithCallback.returnValues.sequenceNumber,
  );
  logger.info(
    { sequenceNumber, txHash: requestResponse.transactionHash },
    `Request submitted`,
  );

  const startTime = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const request = await contract.getRequest(provider, sequenceNumber);
    logger.debug(request);

    if (parseInt(request.sequenceNumber) === 0) {
      // 0 means the request is cleared
      const endTime = Date.now();
      logger.info(
        { sequenceNumber, latency: endTime - startTime },
        `Successful callback`,
      );
      break;
    }
    if (Date.now() - startTime > 60000) {
      logger.error(
        { sequenceNumber },
        "Timeout: 60s passed without the callback being called",
      );
      break;
    }
  }
}

yargs(hideBin(process.argv))
  .parserConfiguration({
    "parse-numbers": false,
  })
  .command({
    command: "run",
    describe: "run the tester until manually stopped",
    builder: {
      validate: {
        description: "Only validate the configs and exit",
        type: "boolean",
        default: false,
        required: false,
      },
      config: {
        description: "Yaml config file",
        type: "string",
        required: true,
      },
      "private-key": {
        type: "string",
        required: true,
        description:
          "Path to the private key to sign the transactions with. Should be hex encoded",
      },
    },
    handler: async (argv: any) => {
      const logger = pino();
      const configs = loadConfig(argv.config);
      if (argv.validate) {
        logger.info("Config validated");
        return;
      }
      const privateKey = toPrivateKey(
        fs
          .readFileSync(argv["private-key"], "utf-8")
          .replace("0x", "")
          .trimEnd(),
      );
      logger.info("Running");
      const promises = configs.map(async ({ contract, interval }) => {
        const child = logger.child({ chain: contract.chain.getId() });
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            await testLatency(contract, privateKey, child);
          } catch (e) {
            child.error(e, "Error testing latency");
          }
          await new Promise((resolve) => setTimeout(resolve, interval * 1000));
        }
      });
      await Promise.all(promises);
    },
  })
  .demandCommand()
  .help().argv;
