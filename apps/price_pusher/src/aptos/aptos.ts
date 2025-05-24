import {
  ChainPriceListener,
  IPricePusher,
  PriceInfo,
  PriceItem,
} from "../interface";
import { AptosAccount, AptosClient } from "aptos";
import { DurationInSeconds } from "../utils";
import { HermesClient } from "@pythnetwork/hermes-client";
import { Logger } from "pino";

export class AptosPriceListener extends ChainPriceListener {
  constructor(
    private pythModule: string,
    private endpoint: string,
    priceItems: PriceItem[],
    private logger: Logger,
    config: {
      pollingFrequency: DurationInSeconds;
    },
  ) {
    super(config.pollingFrequency, priceItems);
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    const client = new AptosClient(this.endpoint);

    const res = await client.getAccountResource(
      this.pythModule,
      `${this.pythModule}::state::LatestPriceInfo`,
    );

    try {
      // This depends upon the pyth contract storage on Aptos and should not be undefined.
      // If undefined, there has been some change and we would need to update accordingly.
      const handle = (res.data as any).info.handle;

      const priceItemRes = await client.getTableItem(handle, {
        key_type: `${this.pythModule}::price_identifier::PriceIdentifier`,
        value_type: `${this.pythModule}::price_info::PriceInfo`,
        key: {
          bytes: priceId,
        },
      });

      const multiplier =
        priceItemRes.price_feed.price.price.negative === true ? -1 : 1;
      const price =
        multiplier * Number(priceItemRes.price_feed.price.price.magnitude);

      this.logger.debug(
        `Polled an Aptos on-chain price for feed ${this.priceIdToAlias.get(
          priceId,
        )} (${priceId}).`,
      );

      return {
        price: price.toString(),
        conf: priceItemRes.price_feed.price.conf,
        publishTime: Number(priceItemRes.price_feed.price.timestamp),
      };
    } catch (err) {
      this.logger.error(
        err,
        `Polling Aptos on-chain price for ${priceId} failed.`,
      );
      return undefined;
    }
  }
}

// Derivation path for aptos accounts
export const APTOS_ACCOUNT_HD_PATH = "m/44'/637'/0'/0'/0'";

/**
 * The `AptosPricePusher` is designed for high-throughput of price updates.
 * Achieving this property requires sacrificing some nice-to-have features of other
 * pusher implementations that can reduce cost when running multiple pushers. Specifically,
 * this implementation does not use `update_price_feeds_if_necssary` and simulate the transaction
 * before submission.
 *
 * If multiple instances of this pusher are running in parallel, both of them will
 * land all of their pushed updates on-chain.
 */
export class AptosPricePusher implements IPricePusher {
  // The last sequence number that has a transaction submitted.
  private lastSequenceNumber: number | undefined;
  // If true, we are trying to fetch the most recent sequence number from the blockchain.
  private sequenceNumberLocked: boolean;

  constructor(
    private hermesClient: HermesClient,
    private logger: Logger,
    private pythContractAddress: string,
    private endpoint: string,
    private mnemonic: string,
    private overrideGasPriceMultiplier: number,
  ) {
    this.sequenceNumberLocked = false;
  }

  /**
   * Gets price update data which then can be submitted to the Pyth contract to update the prices.
   * This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price ids)
   *
   * @param priceIds Array of hex-encoded price ids.
   * @returns Array of price update data.
   */
  async getPriceFeedsUpdateData(priceIds: string[]): Promise<number[][]> {
    const response = await this.hermesClient.getLatestPriceUpdates(priceIds, {
      encoding: "base64",
      ignoreInvalidPriceIds: true,
    });
    return response.binary.data.map((data) =>
      Array.from(Buffer.from(data, "base64")),
    );
  }

  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[],
  ): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    if (priceIds.length !== pubTimesToPush.length)
      throw new Error("Invalid arguments");

    let priceFeedUpdateData;
    try {
      // get the latest VAAs for updatePriceFeed and then push them
      priceFeedUpdateData = await this.getPriceFeedsUpdateData(priceIds);
    } catch (err) {
      this.logger.error(err, "Error fetching the latest vaas to push.");
      return;
    }

    const account = AptosAccount.fromDerivePath(
      APTOS_ACCOUNT_HD_PATH,
      this.mnemonic,
    );
    const client = new AptosClient(this.endpoint);

    const sequenceNumber = await this.tryGetNextSequenceNumber(client, account);
    const rawTx = await client.generateTransaction(
      account.address(),
      {
        function: `${this.pythContractAddress}::pyth::update_price_feeds_with_funder`,
        type_arguments: [],
        arguments: [priceFeedUpdateData],
      },
      {
        sequence_number: sequenceNumber.toFixed(),
      },
    );

    try {
      const signedTx = await client.signTransaction(account, rawTx);
      const pendingTx = await client.submitTransaction(signedTx);

      this.logger.debug(
        { hash: pendingTx.hash },
        "Successfully broadcasted tx.",
      );

      // Sometimes broadcasted txs don't make it on-chain and they cause our sequence number
      // to go out of sync. Missing transactions are rare and we don't want this check to block
      // the next price update. So we use spawn a promise without awaiting on it to wait for the
      // transaction to be confirmed and if it fails, it resets the sequence number and return.
      this.waitForTransactionConfirmation(client, pendingTx.hash);

      return;
    } catch (err: any) {
      this.logger.error(err, "Error executing messages");

      // Reset the sequence number to re-sync it (in case that was the issue)
      this.lastSequenceNumber = undefined;

      return;
    }
  }

  // Wait for the transaction to be confirmed. If it fails, reset the sequence number.
  private async waitForTransactionConfirmation(
    client: AptosClient,
    txHash: string,
  ): Promise<void> {
    try {
      await client.waitForTransaction(txHash, {
        checkSuccess: true,
        timeoutSecs: 10,
      });

      this.logger.info({ hash: txHash }, `Transaction confirmed.`);
    } catch (err) {
      this.logger.error(
        { err, hash: txHash },
        `Transaction failed to confirm.`,
      );

      this.lastSequenceNumber = undefined;
    }
  }

  // Try to get the next sequence number for account. This function uses a local cache
  // to predict the next sequence number if possible; if not, it fetches the number from
  // the blockchain itself (and caches it for later).
  private async tryGetNextSequenceNumber(
    client: AptosClient,
    account: AptosAccount,
  ): Promise<number> {
    if (this.lastSequenceNumber !== undefined) {
      this.lastSequenceNumber += 1;
      return this.lastSequenceNumber;
    } else {
      // Fetch from the blockchain if we don't have the local cache.
      // Note that this is locked so that only 1 fetch occurs regardless of how many updates
      // happen during that fetch.
      if (!this.sequenceNumberLocked) {
        try {
          this.sequenceNumberLocked = true;
          this.lastSequenceNumber = Number(
            (await client.getAccount(account.address())).sequence_number,
          );
          this.logger.debug(
            `Fetched account sequence number: ${this.lastSequenceNumber}`,
          );
          return this.lastSequenceNumber;
        } catch (e: any) {
          throw new Error("Failed to retrieve sequence number" + e);
        } finally {
          this.sequenceNumberLocked = false;
        }
      } else {
        throw new Error("Waiting for sequence number in another thread.");
      }
    }
  }
}
