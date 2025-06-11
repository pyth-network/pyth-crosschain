import { HermesClient } from "@pythnetwork/hermes-client";
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
import { isWsEndpoint, filterInvalidPriceItems } from "../utils";
import { PricePusherMetrics } from "../metrics";
import { createEvmBalanceTracker } from "./balance-tracker";

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
    "gas-price": {
      description: "Override the gas price that would be received from the RPC",
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
    ...options.controllerLogLevel,
    ...options.enableMetrics,
    ...options.metricsPort,
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
      gasPrice,
      updateFeeMultiplier,
      logLevel,
      controllerLogLevel,
      enableMetrics,
      metricsPort,
    } = argv;

    const logger = pino({
      level: logLevel,
    });

    const priceConfigs = readPriceConfigFile(priceConfigFile);
    const hermesClient = new HermesClient(priceServiceEndpoint);

    const mnemonic = fs.readFileSync(mnemonicFile, "utf-8").trim();

    let priceItems = priceConfigs.map(({ id, alias }) => ({ id, alias }));

    // Better to filter out invalid price items before creating the pyth listener
    const { existingPriceItems, invalidPriceItems } =
      await filterInvalidPriceItems(hermesClient, priceItems);

    if (invalidPriceItems.length > 0) {
      logger.error(
        `Invalid price id submitted for: ${invalidPriceItems
          .map(({ alias }) => alias)
          .join(", ")}`,
      );
    }

    priceItems = existingPriceItems;

    // Initialize metrics if enabled
    let metrics: PricePusherMetrics | undefined;
    if (enableMetrics) {
      metrics = new PricePusherMetrics(logger.child({ module: "Metrics" }));
      metrics.start(metricsPort);
      logger.info(`Metrics server started on port ${metricsPort}`);
    }

    const pythListener = new PythPriceListener(
      hermesClient,
      priceItems,
      logger.child({ module: "PythPriceListener" }),
    );

    const client = await createClient(endpoint, mnemonic);
    const pythContract = createPythContract(client, pythContractAddress);

    logger.info(
      `Pushing updates from wallet address: ${client.account.address}`,
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
      },
    );

    const gasStation = getCustomGasStation(
      logger.child({ module: "CustomGasStation" }),
      customGasStation,
      txSpeed,
    );
    const evmPusher = new EvmPricePusher(
      hermesClient,
      client,
      pythContract,
      logger.child({ module: "EvmPricePusher" }),
      overrideGasPriceMultiplier,
      overrideGasPriceMultiplierCap,
      updateFeeMultiplier,
      gasLimit,
      gasStation,
      gasPrice,
    );

    const controller = new Controller(
      priceConfigs,
      pythListener,
      evmListener,
      evmPusher,
      logger.child({ module: "Controller" }, { level: controllerLogLevel }),
      {
        pushingFrequency,
        metrics,
      },
    );

    // Create and start the balance tracker if metrics are enabled
    if (metrics) {
      const balanceTracker = createEvmBalanceTracker({
        client,
        address: client.account.address,
        network: await client.getChainId().then((id) => id.toString()),
        updateInterval: pushingFrequency,
        metrics,
        logger,
      });

      // Start the balance tracker
      await balanceTracker.start();
    }

    await controller.start();
  },
};
