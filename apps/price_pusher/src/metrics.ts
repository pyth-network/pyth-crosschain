/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-misused-promises */
import express from "express";
import type { Logger } from "pino";
import { Counter, Gauge, Registry } from "prom-client";

import { UpdateCondition } from "./price-config.js";

// Define the metrics we want to track
export class PricePusherMetrics {
  private registry: Registry;
  private server: express.Express;
  private logger: Logger;

  // Metrics for price feed updates
  public lastPublishedTime: Gauge;
  public priceUpdateAttempts: Counter;
  public priceFeedsTotal: Gauge;
  public sourceTimestamp: Gauge;
  public configuredTimeDifference: Gauge;
  public sourcePriceValue: Gauge;
  public targetPriceValue: Gauge;
  // Wallet metrics
  public walletBalance: Gauge;

  constructor(logger: Logger) {
    this.logger = logger;
    this.registry = new Registry();
    this.server = express();

    // Register the default metrics (memory, CPU, etc.)
    this.registry.setDefaultLabels({ app: "price_pusher" });

    // Create metrics
    this.lastPublishedTime = new Gauge({
      help: "The last published time of a price feed in unix timestamp",
      labelNames: ["price_id", "alias"],
      name: "pyth_price_last_published_time",
      registers: [this.registry],
    });

    this.priceUpdateAttempts = new Counter({
      help: "Total number of price update attempts with their trigger condition and status",
      labelNames: ["price_id", "alias", "trigger", "status"],
      name: "pyth_price_update_attempts_total",
      registers: [this.registry],
    });

    this.priceFeedsTotal = new Gauge({
      help: "Total number of price feeds being monitored",
      name: "pyth_price_feeds_total",
      registers: [this.registry],
    });

    this.sourceTimestamp = new Gauge({
      help: "Latest source chain price publish timestamp",
      labelNames: ["price_id", "alias"],
      name: "pyth_source_timestamp",
      registers: [this.registry],
    });

    this.configuredTimeDifference = new Gauge({
      help: "Configured time difference threshold between source and target chains",
      labelNames: ["price_id", "alias"],
      name: "pyth_configured_time_difference",
      registers: [this.registry],
    });

    this.sourcePriceValue = new Gauge({
      help: "Latest price value from Pyth source",
      labelNames: ["price_id", "alias"],
      name: "pyth_source_price",
      registers: [this.registry],
    });

    this.targetPriceValue = new Gauge({
      help: "Latest price value from target chain",
      labelNames: ["price_id", "alias"],
      name: "pyth_target_price",
      registers: [this.registry],
    });

    // Wallet balance metric
    this.walletBalance = new Gauge({
      help: "Current wallet balance of the price pusher in native token units",
      labelNames: ["wallet_address", "network"],
      name: "pyth_wallet_balance",
      registers: [this.registry],
    });

    // Setup the metrics endpoint
    this.server.get("/metrics", async (_, res) => {
      res.set("Content-Type", this.registry.contentType);
      res.end(await this.registry.metrics());
    });
  }

  // Start the metrics server
  public start(port: number): void {
    this.server.listen(port, () => {
      this.logger.info(`Metrics server started on port ${port}`);
    });
  }

  // Record a successful price update
  public recordPriceUpdate(
    priceId: string,
    alias: string,
    trigger = "yes",
  ): void {
    this.priceUpdateAttempts.inc({
      alias,
      price_id: priceId,
      status: "success",
      trigger: trigger.toLowerCase(),
    });
  }

  // Record update condition status (YES/NO/EARLY)
  public recordUpdateCondition(
    priceId: string,
    alias: string,
    condition: UpdateCondition,
  ): void {
    const triggerLabel = UpdateCondition[condition].toLowerCase();
    // Only record as 'skipped' when the condition is NO
    if (condition === UpdateCondition.NO) {
      this.priceUpdateAttempts.inc({
        alias,
        price_id: priceId,
        status: "skipped",
        trigger: triggerLabel,
      });
    }
    // YES and EARLY don't increment the counter here - they'll be counted
    // when recordPriceUpdate or recordPriceUpdateError is called
  }

  // Record a price update error
  public recordPriceUpdateError(
    priceId: string,
    alias: string,
    trigger = "yes",
  ): void {
    this.priceUpdateAttempts.inc({
      alias,
      price_id: priceId,
      status: "error",
      trigger: trigger.toLowerCase(),
    });
  }

  // Set the number of price feeds
  public setPriceFeedsTotal(count: number): void {
    this.priceFeedsTotal.set(count);
  }

  // Update source, target and configured time difference timestamps
  public updateTimestamps(
    priceId: string,
    alias: string,
    targetLatestPricePublishTime: number,
    sourceLatestPricePublishTime: number,
    priceConfigTimeDifference: number,
  ): void {
    this.sourceTimestamp.set(
      { alias, price_id: priceId },
      sourceLatestPricePublishTime,
    );
    this.lastPublishedTime.set(
      { alias, price_id: priceId },
      targetLatestPricePublishTime,
    );
    this.configuredTimeDifference.set(
      { alias, price_id: priceId },
      priceConfigTimeDifference,
    );
  }

  // Update price values
  public updatePriceValues(
    priceId: string,
    alias: string,
    sourcePrice: string | undefined,
    targetPrice: string | undefined,
  ): void {
    if (sourcePrice !== undefined) {
      this.sourcePriceValue.set(
        { alias, price_id: priceId },
        Number(sourcePrice),
      );
    }
    if (targetPrice !== undefined) {
      this.targetPriceValue.set(
        { alias, price_id: priceId },
        Number(targetPrice),
      );
    }
  }

  // Update wallet balance
  public updateWalletBalance(
    walletAddress: string,
    network: string,
    balance: bigint | number,
  ): void {
    // Convert to number for compatibility with prometheus
    const balanceNum =
      typeof balance === "bigint" ? Number(balance) / 1e18 : balance;
    this.walletBalance.set(
      { network, wallet_address: walletAddress },
      balanceNum,
    );
    this.logger.debug(
      `Updated wallet balance metric: ${walletAddress} = ${balanceNum}`,
    );
  }
}
