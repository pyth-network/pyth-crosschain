import { HexString, UnixTimestamp } from "@pythnetwork/hermes-client";
import { DurationInSeconds } from "./utils";
import { Logger } from "pino";
import { PricePusherMetrics } from "./metrics";

export type PriceItem = {
  id: HexString;
  alias: string;
};

export type PriceInfo = {
  price: string;
  conf: string;
  publishTime: UnixTimestamp;
};

export interface IPriceListener {
  // start fetches the latest price initially and then keep updating it
  start(): Promise<void>;
  getLatestPriceInfo(priceId: string): PriceInfo | undefined;
}

export abstract class ChainPriceListener implements IPriceListener {
  private latestPriceInfo: Map<HexString, PriceInfo>;
  protected priceIdToAlias: Map<HexString, string>;

  constructor(
    private pollingFrequency: DurationInSeconds,
    protected priceItems: PriceItem[],
  ) {
    this.latestPriceInfo = new Map();
    this.priceIdToAlias = new Map(
      priceItems.map(({ id, alias }) => [id, alias]),
    );
  }

  async start() {
    setInterval(this.pollPrices.bind(this), this.pollingFrequency * 1000);

    await this.pollPrices();
  }

  private async pollPrices() {
    for (const { id: priceId } of this.priceItems) {
      const currentPriceInfo = await this.getOnChainPriceInfo(priceId);
      if (currentPriceInfo !== undefined) {
        this.updateLatestPriceInfo(priceId, currentPriceInfo);
      }
    }
  }

  protected updateLatestPriceInfo(
    priceId: HexString,
    observedPrice: PriceInfo,
  ) {
    const cachedLatestPriceInfo = this.getLatestPriceInfo(priceId);

    // Ignore the observed price if the cache already has newer
    // price. This could happen because we are using polling and
    // subscription at the same time.
    if (
      cachedLatestPriceInfo !== undefined &&
      cachedLatestPriceInfo.publishTime > observedPrice.publishTime
    ) {
      return;
    }

    this.latestPriceInfo.set(priceId, observedPrice);
  }

  // Should return undefined only when the price does not exist.
  getLatestPriceInfo(priceId: string): PriceInfo | undefined {
    return this.latestPriceInfo.get(priceId);
  }

  abstract getOnChainPriceInfo(
    priceId: HexString,
  ): Promise<PriceInfo | undefined>;
}

export interface IPricePusher {
  updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: UnixTimestamp[],
  ): Promise<void>;
}

/**
 * Common configuration properties for all balance trackers
 */
export interface BaseBalanceTrackerConfig {
  /** Address of the wallet to track */
  address: string;
  /** Name/ID of the network/chain */
  network: string;
  /** How often to update the balance */
  updateInterval: DurationInSeconds;
  /** Metrics instance to report balance updates */
  metrics: PricePusherMetrics;
  /** Logger instance */
  logger: Logger;
}

/**
 * Interface for all balance trackers to implement
 * Each chain will have its own implementation of this interface
 */
export interface IBalanceTracker {
  /**
   * Start tracking the wallet balance
   */
  start(): Promise<void>;

  /**
   * Stop tracking the wallet balance
   */
  stop(): void;
}

/**
 * Abstract base class that implements common functionality for all balance trackers
 */
export abstract class BaseBalanceTracker implements IBalanceTracker {
  protected address: string;
  protected network: string;
  protected updateInterval: DurationInSeconds;
  protected metrics: PricePusherMetrics;
  protected logger: Logger;
  protected isRunning: boolean = false;

  constructor(config: BaseBalanceTrackerConfig) {
    this.address = config.address;
    this.network = config.network;
    this.updateInterval = config.updateInterval;
    this.metrics = config.metrics;
    this.logger = config.logger;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Initial balance update
    await this.updateBalance();

    // Start the update loop
    this.startUpdateLoop();
  }

  private async startUpdateLoop(): Promise<void> {
    // We're using dynamic import to avoid circular dependencies
    const { sleep } = await import("./utils");

    // Run in a loop to regularly update the balance
    for (;;) {
      // Wait first, since we already did the initial update in start()
      await sleep(this.updateInterval * 1000);

      // Only continue if we're still running
      if (!this.isRunning) {
        break;
      }

      await this.updateBalance();
    }
  }

  /**
   * Chain-specific balance update implementation
   * Each chain will implement this method differently
   */
  protected abstract updateBalance(): Promise<void>;

  public stop(): void {
    this.isRunning = false;
  }
}
