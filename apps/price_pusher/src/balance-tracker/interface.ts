import { Logger } from "pino";
import { PricePusherMetrics } from "../metrics";
import { DurationInSeconds } from "../utils";

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
    const { sleep } = await import("../utils");

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
