#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import YAML from "yaml";
import fs from "fs";
import pino from "pino";
import { DefaultStore } from "@pythnetwork/contract-manager/node/store";
import { EvmEntropyContract } from "@pythnetwork/contract-manager/core/contracts/evm";
import { PrivateKey, toPrivateKey } from "@pythnetwork/contract-manager/core/base";

type DurationSeconds = number;
type LoadedConfig = {
    contract: EvmEntropyContract,
    interval: DurationSeconds
}

function timeToSeconds(timeStr: string): number {
    const match = timeStr.match(/^(\d+)([hms])$/i);
    if (!match) throw new Error("Invalid format. Use formats like '6h', '15m', or '30s'.");

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 'h': return value * 3600;
        case 'm': return value * 60;
        case 's': return value;
        default: throw new Error("Unsupported time unit.");
    }
}
const logger = pino();

function loadConfig(configPath: string): LoadedConfig {
    const config = YAML.parse(fs.readFileSync(configPath, "utf-8"));
    const contracts = Object.values(DefaultStore.entropy_contracts).filter((contract) => (
        contract.chain.getId() == config['chain-id']
    ))
    if (contracts.length === 0) {
        logger.error("Couldn't find the contract id, check contract manager store.")
        process.exit(1)
    }
    const interval = timeToSeconds(config['interval']);
    return { contract: contracts[0], interval }
}


async function testLatency(
    contract: EvmEntropyContract,
    privateKey: PrivateKey,
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
    const sequenceNumber =
        parseInt(requestResponse.events.RequestedWithCallback.returnValues.sequenceNumber);
    logger.info(`Request tx hash: ${requestResponse.transactionHash} Seq. No: ${sequenceNumber}`);

    const startTime = Date.now();

    // eslint-disable-next-line no-constant-condition
    while (true) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const request = await contract.getRequest(provider, sequenceNumber);
        logger.debug(request)

        if (parseInt(request.sequenceNumber) === 0) { // 0 means the request is cleared
            const endTime = Date.now();
            logger.info(`Fortuna Latency: ${endTime - startTime}ms`);
            break;
        }
        if (Date.now() - startTime > 60000) {
            logger.error("Timeout: 60s passed without the callback being called.");
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
                required: false
            },
            config: {
                description: "Yaml config file",
                type: "string",
                required: true,
            },
            "private-key": {
                type: "string",
                required: true,
                description: "Path to the private key to sign the transactions with. Should be hex encoded",
            },
        },
        handler: async (argv: any) => {
            const { contract, interval } = loadConfig(argv.config);
            if (argv.validate) {
                logger.info("Config validated")
                return;
            }
            const privateKey = toPrivateKey(fs.readFileSync(argv['private-key'], "utf-8").replace('0x', '').trimEnd())
            logger.info("Running")
            // eslint-disable-next-line no-constant-condition
            while (true) {
                await testLatency(contract, privateKey);
                await new Promise((resolve) => setTimeout(resolve, interval));
            }
        }
    })
    .demandCommand()
    .help().argv;
