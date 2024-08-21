import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import fs from "fs";
import { Options } from "yargs";
import * as options from "../options";
import { readPriceConfigFile } from "../price-config";
import { PythPriceListener } from "../pyth-price-listener";
import { Controller } from "../controller";
import { EvmPriceListener, EvmPricePusher } from "./evm";
import { getCustomGasStation } from "./custom-gas-station";
import pino from "pino";
import { createClient } from "./super-wallet";
import { createPythContract } from "./pyth-contract";
import { isWsEndpoint } from "../utils";

export default {
  command: "evm",
  describe: "run price pusher for evm",
  builder: {
    endpoint: {
      description:
        "RPC endpoint URL for evm network. If you provide a normal HTTP endpoint, the pusher " +
        "will periodically poll for updates. The polling interval is configurable via the " +
        "`polling-frequency` command-line argument. If you provide a websocket RPC " +
        "endpoint (`ws[s]://...`), the price pusher will use event subscriptions to read " +
        "the current EVM price in addition to polling. ",
      type: "string",
      required: true,
    } as Options,
    "custom-gas-station": {
      description:
        "If using a custom gas station, chainId of custom gas station to use",
      type: "number",
      required: false,
    } as Options,
    "tx-speed": {
      description:
        "txSpeed for custom gas station. choose between 'slow'|'standard'|'fast'",
      choices: ["slow", "standard", "fast"],
      required: false,
    } as Options,
    "override-gas-price-multiplier": {
      description:
        "Multiply the previous gas price by this number if the transaction is not landing to override. " +
        "Please note that the gas price can grow exponentially on consecutive failures; " +
        "to set a cap on the multiplier, use the `override-gas-price-multiplier-cap` option." +
        "Default to 1.1",
      type: "number",
      required: false,
      default: 1.1,
    } as Options,
    "override-gas-price-multiplier-cap": {
      description:
        "Maximum gas price multiplier to use in override compared to the RPC returned " +
        "gas price. Default to 5",
      type: "number",
      required: false,
      default: 5,
    } as Options,
    "gas-limit": {
      description: "Gas limit for the transaction",
      type: "number",
      required: false,
    } as Options,
    "update-fee-multiplier": {
      description:
        "Multiplier for the fee to update the price. It is useful in networks " +
        "such as Hedera where setting on-chain getUpdateFee as the transaction value " +
        "won't work. Default to 1",
      type: "number",
      required: false,
      default: 1,
    } as Options,
    ...options.priceConfigFile,
    ...options.priceServiceEndpoint,
    ...options.mnemonicFile,
    ...options.pythContractAddress,
    ...options.pollingFrequency,
    ...options.pushingFrequency,
    ...options.logLevel,
    ...options.priceServiceConnectionLogLevel,
    ...options.controllerLogLevel,
  },
  handler: async function (argv: any) {
    // FIXME: type checks for this
    const {
      endpoint,
      priceConfigFile,
      priceServiceEndpoint,
      mnemonicFile,
      pythContractAddress,
      pushingFrequency,
      pollingFrequency,
      customGasStation,
      txSpeed,
      overrideGasPriceMultiplier,
      overrideGasPriceMultiplierCap,
      gasLimit,
      updateFeeMultiplier,
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

    const mnemonic = fs.readFileSync(mnemonicFile, "utf-8").trim();

    const priceItems = priceConfigs.map(({ id, alias }) => ({ id, alias }));

    const pythListener = new PythPriceListener(
      priceServiceConnection,
      priceItems,
      logger.child({ module: "PythPriceListener" })
    );

    const client = await createClient(endpoint, mnemonic);
    const pythContract = createPythContract(client, pythContractAddress);

    logger.info(
      `Pushing updates from wallet address: ${client.account.address}`
    );

    // It is possible to watch the events in the non-ws endpoints, either by getFilter
    // or by getLogs, but it is very expensive and our polling mechanism does it
    // in a more efficient way. So we only do it with ws endpoints.
    const watchEvents = isWsEndpoint(endpoint);

    const evmListener = new EvmPriceListener(
      pythContract,
      priceItems,
      watchEvents,
      logger.child({ module: "EvmPriceListener" }),
      {
        pollingFrequency,
      }
    );

    const gasStation = getCustomGasStation(
      logger.child({ module: "CustomGasStation" }),
      customGasStation,
      txSpeed
    );
    const evmPusher = new EvmPricePusher(
      priceServiceConnection,
      client,
      pythContract,
      logger.child({ module: "EvmPricePusher" }),
      overrideGasPriceMultiplier,
      overrideGasPriceMultiplierCap,
      updateFeeMultiplier,
      gasLimit,
      gasStation
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      evmListener,
      evmPusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      { pushingFrequency }
    );

    controller.start();
  },
};
