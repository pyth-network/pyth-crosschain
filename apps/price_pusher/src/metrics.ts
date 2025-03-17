import { Registry, Counter, Gauge, Histogram } from "prom-client";
import express from "express";
import { PriceInfo } from "./interface";
import { Logger } from "pino";

// Define the metrics we want to track
export class PricePusherMetrics {
  private registry: Registry;
  private server: express.Express;
  private logger: Logger;

  // Metrics for price feed updates
  public lastPublishedTime: Gauge<string>;
  public priceUpdatesTotal: Counter<string>;
  public priceUpdateDuration: Histogram<string>;
  public activePriceFeeds: Gauge<string>;
  public priceUpdateErrors: Counter<string>;
  public priceUpdateAttempts: Counter<string>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.registry = new Registry();
    this.server = express();

    // Register the default metrics (memory, CPU, etc.)
    this.registry.setDefaultLabels({ app: "price_pusher" });

    // Create metrics
    this.lastPublishedTime = new Gauge({
      name: "pyth_price_last_published_time",
      help: "The last published time of a price feed in unix timestamp",
      labelNames: ["price_id", "alias"],
      registers: [this.registry],
    });

    this.priceUpdatesTotal = new Counter({
      name: "pyth_price_updates_total",
      help: "Total number of price updates pushed to the chain",
      labelNames: ["price_id", "alias"],
      registers: [this.registry],
    });

    this.priceUpdateDuration = new Histogram({
      name: "pyth_price_update_duration_seconds",
      help: "Duration of price update operations in seconds",
      labelNames: ["price_id", "alias"],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.activePriceFeeds = new Gauge({
      name: "pyth_active_price_feeds",
      help: "Number of active price feeds being monitored",
      registers: [this.registry],
    });

    this.priceUpdateErrors = new Counter({
      name: "pyth_price_update_errors_total",
      help: "Total number of errors encountered during price updates",
      labelNames: ["price_id", "alias", "error_type"],
      registers: [this.registry],
    });

    this.priceUpdateAttempts = new Counter({
      name: "pyth_price_update_attempts_total",
      help: "Total number of price update attempts",
      labelNames: ["price_id", "alias"],
      registers: [this.registry],
    });

    // Setup the metrics endpoint
    this.server.get("/metrics", async (req, res) => {
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

  // Update the last published time for a price feed
  public updateLastPublishedTime(
    priceId: string,
    alias: string,
    priceInfo: PriceInfo
  ): void {
    this.lastPublishedTime.set(
      { price_id: priceId, alias },
      priceInfo.publishTime
    );
  }

  // Record a successful price update
  public recordPriceUpdate(priceId: string, alias: string): void {
    this.priceUpdatesTotal.inc({ price_id: priceId, alias });
  }

  // Record a price update attempt
  public recordPriceUpdateAttempt(priceId: string, alias: string): void {
    this.priceUpdateAttempts.inc({ price_id: priceId, alias });
  }

  // Record a price update error
  public recordPriceUpdateError(
    priceId: string,
    alias: string,
    errorType: string
  ): void {
    this.priceUpdateErrors.inc({
      price_id: priceId,
      alias,
      error_type: errorType,
    });
  }

  // Set the number of active price feeds
  public setActivePriceFeeds(count: number): void {
    this.activePriceFeeds.set(count);
  }

  // Create a timer for measuring price update duration
  public startPriceUpdateTimer(priceId: string, alias: string): () => void {
    const end = this.priceUpdateDuration.startTimer({
      price_id: priceId,
      alias,
    });
    return end;
  }
}
