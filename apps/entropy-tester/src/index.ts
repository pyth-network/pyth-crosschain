import fs from "node:fs/promises";

import type { PrivateKey } from "@pythnetwork/contract-manager/core/base";
import { toPrivateKey } from "@pythnetwork/contract-manager/core/base";
import { EvmEntropyContract } from "@pythnetwork/contract-manager/core/contracts/evm";
import { DefaultStore } from "@pythnetwork/contract-manager/node/store";
import type { Logger } from "pino";
import { pino } from "pino";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";

type LoadedConfig = {
  contract: EvmEntropyContract;
  interval: number;
};

function timeToSeconds(timeStr: string): number {
  const match = /^(\d+)([hms])$/i.exec(timeStr);
  if (!match?.[1] || !match[2])
    throw new Error("Invalid format. Use formats like '6h', '15m', or '30s'.");

  const value = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "h": {
      return value * 3600;
    }
    case "m": {
      return value * 60;
    }
    case "s": {
      return value;
    }
    default: {
      throw new Error("Unsupported time unit.");
    }
  }
}

async function loadConfig(configPath: string): Promise<LoadedConfig[]> {
  const configSchema = z.array(
    z.strictObject({
      "chain-id": z.string(),
      interval: z.string(),
    }),
  );
  const configContent = (await import(configPath, {
    with: { type: "json" },
  })) as { default: string };
  const configs = configSchema.parse(configContent.default);
  const loadedConfigs = configs.map((config) => {
    const interval = timeToSeconds(config.interval);
    const contracts = Object.values(DefaultStore.entropy_contracts).filter(
      (contract) => contract.chain.getId() == config["chain-id"],
    );
    const firstContract = contracts[0];
    if (contracts.length === 0 || !firstContract) {
      throw new Error(
        `Can not find the contract for chain ${config["chain-id"]}, check contract manager store.`,
      );
    }
    if (contracts.length > 1) {
      throw new Error(
        `Multiple contracts found for chain ${config["chain-id"]}, check contract manager store.`,
      );
    }
    return { contract: firstContract, interval };
  });
  return loadedConfigs;
}

async function testLatency(
  contract: EvmEntropyContract,
  privateKey: PrivateKey,
  logger: Logger,
) {
  const provider = await contract.getDefaultProvider();
  const userRandomNumber = contract.generateUserRandomNumber();
  const requestResponseSchema = z.object({
    transactionHash: z.string(),
    events: z.object({
      RequestedWithCallback: z.object({
        returnValues: z.object({
          sequenceNumber: z.string(),
        }),
      }),
    }),
  });
  const requestResponse = requestResponseSchema.parse(
    await contract.requestRandomness(
      userRandomNumber,
      provider,
      privateKey,
      true, // with callback
    ),
  );
  // Read the sequence number for the request from the transaction events.
  const sequenceNumber = Number.parseInt(
    requestResponse.events.RequestedWithCallback.returnValues.sequenceNumber,
  );
  logger.info(
    { sequenceNumber, txHash: requestResponse.transactionHash },
    `Request submitted`,
  );

  const startTime = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const request = await contract.getRequest(provider, sequenceNumber);
    logger.debug(request);

    if (Number.parseInt(request.sequenceNumber) === 0) {
      // 0 means the request is cleared
      const endTime = Date.now();
      logger.info(
        { sequenceNumber, latency: endTime - startTime },
        `Successful callback`,
      );
      break;
    }
    if (Date.now() - startTime > 60_000) {
      logger.error(
        { sequenceNumber },
        "Timeout: 60s passed without the callback being called",
      );
      break;
    }
  }
}

const RUN_OPTIONS = {
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
} as const;

export const main = function () {
  return yargs(hideBin(process.argv))
    .parserConfiguration({
      "parse-numbers": false,
    })
    .command(
      "run",
      "run the tester until manually stopped",
      RUN_OPTIONS,
      async (argv) => {
        const logger = pino();
        const configs = await loadConfig(argv.config);
        if (argv.validate) {
          logger.info("Config validated");
          return;
        }
        const privateKeyFileContent = await fs.readFile(
          argv["private-key"],
          "utf8",
        );
        const privateKey = toPrivateKey(
          privateKeyFileContent.replace("0x", "").trimEnd(),
        );
        logger.info("Running");
        const promises = configs.map(async ({ contract, interval }) => {
          const child = logger.child({ chain: contract.chain.getId() });
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          while (true) {
            try {
              await Promise.race([
                testLatency(contract, privateKey, child),
                new Promise((_, reject) =>
                  setTimeout(() => {
                    reject(
                      new Error(
                        "Timeout: 120s passed but testLatency function was not resolved",
                      ),
                    );
                  }, 120_000),
                ),
              ]);
            } catch (error) {
              child.error(error, "Error testing latency");
            }
            await new Promise((resolve) =>
              setTimeout(resolve, interval * 1000),
            );
          }
        });
        await Promise.all(promises);
      },
    )
    .demandCommand()
    .help();
};
