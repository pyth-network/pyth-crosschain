import { Registry, Counter, Gauge } from "prom-client";
import express from "express";
import { PriceInfo } from "./interface";
import { Logger } from "pino";
import { UpdateCondition } from "./price-config";

// Define the metrics we want to track
export class PricePusherMetrics {
  private registry: Registry;
  private server: express.Express;
  private logger: Logger;

  // Metrics for price feed updates
  public lastPublishedTime: Gauge<string>;
  public priceUpdatesTotal: Counter<string>;
  public priceFeedsTotal: Gauge<string>;
  public priceUpdateErrors: Counter<string>;
  public updateConditionsTotal: Counter<string>;
  // Wallet metrics
  public walletBalance: Gauge<string>;

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

    this.priceFeedsTotal = new Gauge({
      name: "pyth_price_feeds_total",
      help: "Total number of price feeds being monitored",
      registers: [this.registry],
    });

    this.priceUpdateErrors = new Counter({
      name: "pyth_price_update_errors_total",
      help: "Total number of errors encountered during price updates",
      labelNames: ["price_id", "alias", "error_type"],
      registers: [this.registry],
    });

    this.updateConditionsTotal = new Counter({
      name: "pyth_update_conditions_total",
      help: "Total number of price update condition checks by status (YES/NO/EARLY)",
      labelNames: ["price_id", "alias", "condition"],
      registers: [this.registry],
    });

    // Wallet balance metric
    this.walletBalance = new Gauge({
      name: "pyth_wallet_balance",
      help: "Current wallet balance of the price pusher in native token units",
      labelNames: ["wallet_address", "network"],
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
    priceInfo: PriceInfo,
  ): void {
    this.lastPublishedTime.set(
      { price_id: priceId, alias },
      priceInfo.publishTime,
    );
  }

  // Record a successful price update
  public recordPriceUpdate(priceId: string, alias: string): void {
    this.priceUpdatesTotal.inc({ price_id: priceId, alias });
  }

  // Record update condition status (YES/NO/EARLY)
  public recordUpdateCondition(
    priceId: string,
    alias: string,
    condition: UpdateCondition,
  ): void {
    const conditionLabel = UpdateCondition[condition];
    this.updateConditionsTotal.inc({
      price_id: priceId,
      alias,
      condition: conditionLabel,
    });
  }

  // Record a price update error
  public recordPriceUpdateError(
    priceId: string,
    alias: string,
    errorType: string,
  ): void {
    this.priceUpdateErrors.inc({
      price_id: priceId,
      alias,
      error_type: errorType,
    });
  }

  // Set the number of price feeds
  public setPriceFeedsTotal(count: number): void {
    this.priceFeedsTotal.set(count);
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
      { wallet_address: walletAddress, network },
      balanceNum,
    );
    this.logger.debug(
      `Updated wallet balance metric: ${walletAddress} = ${balanceNum}`,
    );
  }
}
