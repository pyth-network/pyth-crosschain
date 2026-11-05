/* biome-ignore-all lint/suspicious/noExplicitAny: pre-existing; untyped Hermes and Jito errors */
import type { HermesClient } from "@pythnetwork/hermes-client";
import { sliceAccumulatorUpdateData } from "@pythnetwork/price-service-sdk";
import type { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import type { PriorityFeeConfig } from "@pythnetwork/solana-utils";
import {
  sendTransactions,
  sendTransactionsJito,
} from "@pythnetwork/solana-utils";
import type { AddressLookupTableAccount, Keypair } from "@solana/web3.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { SearcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import type { Logger } from "pino";

import type { IPricePusher, PriceInfo, PriceItem } from "../interface.js";
import { ChainPriceListener } from "../interface.js";
import type { DurationInSeconds } from "../utils.js";
import { sendV1Transactions } from "./transaction-v1.js";

const HEALTH_CHECK_TIMEOUT_SECONDS = 60;

/**
 * The transaction version that `SolanaPricePusher` sends. Some SVM chains, such as Fogo, cannot parse v1 transactions.
 */
export type SolanaTransactionVersion = "v0" | "v1";

// Encoded VAA accounts created by a partially-landed batch are only closed by
// the builder that created them, so a failed send orphans their rent. Rebuild a
// sweep from all accounts the wallet still owns (this also drains orphans from
// earlier cycles) and send it best-effort; never mask the caller's error path.
async function closeStaleEncodedVaas(
  pythSolanaReceiver: PythSolanaReceiver,
  logger: Logger,
  priorityFeeConfig: PriorityFeeConfig,
): Promise<void> {
  try {
    const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
      closeUpdateAccounts: false,
    });
    await transactionBuilder.addClosePreviousEncodedVaasInstructions();
    const transactions =
      await transactionBuilder.buildVersionedTransactions(priorityFeeConfig);
    if (transactions.length === 0) {
      return;
    }
    const signatures = await sendTransactions(
      transactions,
      pythSolanaReceiver.connection,
      pythSolanaReceiver.wallet,
      undefined,
      logger,
    );
    logger.debug(
      { signatures },
      "closed stale encoded VAA accounts after a failed send",
    );
  } catch (error: unknown) {
    logger.error(error, "closeStaleEncodedVaas failed");
  }
}

export class SolanaPriceListener extends ChainPriceListener {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private shardId: number,
    priceItems: PriceItem[],
    private logger: Logger,
    config: {
      pollingFrequency: DurationInSeconds;
    },
  ) {
    super(config.pollingFrequency, priceItems);
  }

  // Checking the health of the Solana connection by checking the last block time
  // and ensuring it is not older than 30 seconds.
  private async checkHealth() {
    const slot = await this.pythSolanaReceiver.connection.getSlot("finalized");
    try {
      const blockTime =
        await this.pythSolanaReceiver.connection.getBlockTime(slot);
      if (
        (blockTime === null ||
          blockTime < Date.now() / 1000 - HEALTH_CHECK_TIMEOUT_SECONDS) &&
        blockTime !== null
      ) {
        this.logger.warn(
          `Solana connection is behind by ${(
            Date.now() / 1000 - blockTime
          ).toString()} seconds`,
        );
      }
    } catch (error) {
      this.logger.error({ err: error }, "checkHealth failed");
    }
  }

  override async start() {
    // Frequently check the RPC connection to ensure it is healthy
    setInterval(() => void this.checkHealth(), 5000);

    await super.start();
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const priceFeedAccount =
        await this.pythSolanaReceiver.fetchPriceFeedAccount(
          this.shardId,
          Buffer.from(priceId, "hex"),
        );
      this.logger.debug(
        `Polled a Solana on chain price for feed ${
          this.priceIdToAlias.get(priceId)?.toString() ?? ""
        } (${priceId}).`,
      );
      return priceFeedAccount
        ? {
            conf: priceFeedAccount.priceMessage.conf.toString(),
            price: priceFeedAccount.priceMessage.price.toString(),
            publishTime: priceFeedAccount.priceMessage.publishTime.toNumber(),
          }
        : undefined;
    } catch (error) {
      this.logger.error(
        { err: error, priceId },
        `Polling on-chain price failed.`,
      );
      return undefined;
    }
  }
}

/**
 * Pushes price updates with v0 or v1 transactions (SIMD-0385).
 *
 * With v0 transactions, the pusher posts the VAA, updates the price feeds and closes the encoded VAA account in
 * separate transactions, and can use an address lookup table.
 *
 * With v1 transactions, each transaction is self-contained: it creates an encoded VAA account, writes and verifies the VAA,
 * updates as many price feed accounts as fit in the transaction, and closes the encoded VAA account.
 * No on-chain state remains after the transaction, and a failed transaction leaves no account behind.
 */
export class SolanaPricePusher implements IPricePusher {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private hermesClient: HermesClient,
    private logger: Logger,
    private shardId: number,
    private computeUnitPriceMicroLamports: number,
    private payer: Keypair,
    private transactionVersion: SolanaTransactionVersion = "v0",
    private addressLookupTableAccount?: AddressLookupTableAccount,
  ) {}

  async updatePriceFeed(priceIds: string[]): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    const shuffledPriceIds = priceIds
      .map((x) => {
        return { element: x, key: Math.random() };
      })
      .sort((a, b) => a.key - b.key)
      .map((x) => x.element);

    let priceFeedUpdateData;
    try {
      const response = await this.hermesClient.getLatestPriceUpdates(
        shuffledPriceIds,
        {
          encoding: "base64",
          ignoreInvalidPriceIds: true,
        },
      );
      priceFeedUpdateData = response.binary.data;
    } catch (error: unknown) {
      this.logger.error(error, "getPriceFeedsUpdateData failed:");
      return;
    }

    try {
      const signatures =
        this.transactionVersion === "v1"
          ? await this.sendV1Transactions(priceFeedUpdateData)
          : await this.sendV0Transactions(priceFeedUpdateData);
      this.logger.debug({ signatures }, "updatePriceFeed successful");
    } catch (error: any) {
      this.logger.error(error, "updatePriceFeed failed");
      // v1 transactions close their own encoded VAA accounts, so only the v0 path
      // can leave orphans behind.
      if (this.transactionVersion === "v0") {
        await closeStaleEncodedVaas(this.pythSolanaReceiver, this.logger, {
          computeUnitPriceMicroLamports: this.computeUnitPriceMicroLamports,
          tightComputeBudget: true,
        });
      }
      return;
    }
  }

  /**
   * Build v0 transactions that post the VAA, update the price feeds and close the encoded VAA account.
   */
  async buildV0Transactions(priceFeedUpdateData: string[]) {
    const transactionBuilder = this.pythSolanaReceiver.newTransactionBuilder(
      {
        closeUpdateAccounts: true,
      },
      this.addressLookupTableAccount,
    );
    await transactionBuilder.addUpdatePriceFeed(
      priceFeedUpdateData,
      this.shardId,
    );
    return transactionBuilder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: this.computeUnitPriceMicroLamports,
      tightComputeBudget: true,
    });
  }

  private async sendV0Transactions(
    priceFeedUpdateData: string[],
  ): Promise<string[]> {
    return sendTransactions(
      await this.buildV0Transactions(priceFeedUpdateData),
      this.pythSolanaReceiver.connection,
      this.pythSolanaReceiver.wallet,
      undefined,
      this.logger,
    );
  }

  private sendV1Transactions(priceFeedUpdateData: string[]): Promise<string[]> {
    return sendV1Transactions(
      {
        computeUnitPriceMicroLamports: this.computeUnitPriceMicroLamports,
        payer: this.payer,
        pythSolanaReceiver: this.pythSolanaReceiver,
        shardId: this.shardId,
      },
      priceFeedUpdateData,
      this.pythSolanaReceiver.connection,
      this.logger,
    );
  }
}

export class SolanaPricePusherJito implements IPricePusher {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private hermesClient: HermesClient,
    private logger: Logger,
    private shardId: number,
    private defaultJitoTipLamports: number,
    private dynamicJitoTips: boolean,
    private maxJitoTipLamports: number,
    private searcherClients: SearcherClient[],
    private updatesPerJitoBundle: number,
    private maxRetryTimeMs: number,
    private addressLookupTableAccount?: AddressLookupTableAccount,
  ) {}

  async getRecentJitoTipLamports(): Promise<number | undefined> {
    try {
      const response = await fetch(
        "https://bundles.jito.wtf/api/v1/bundles/tip_floor",
      );
      if (!response.ok) {
        this.logger.warn(
          { status: response.status, statusText: response.statusText },
          "getRecentJitoTips http request failed",
        );
        return undefined;
      }
      const data = (await response.json()) as {
        landed_tips_50th_percentile: number | string;
      }[];
      const tipFloor = data[0]?.landed_tips_50th_percentile;
      if (tipFloor === undefined) {
        this.logger.warn("getRecentJitoTips returned no tip entries");
        return undefined;
      }
      return Math.floor(Number(tipFloor) * LAMPORTS_PER_SOL);
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.logger.warn({ err: error }, "getRecentJitoTips failed");
      return undefined;
    }
  }

  async updatePriceFeed(priceIds: string[]): Promise<void> {
    const recentJitoTip = await this.getRecentJitoTipLamports();
    const jitoTip =
      this.dynamicJitoTips && recentJitoTip !== undefined
        ? Math.max(this.defaultJitoTipLamports, recentJitoTip)
        : this.defaultJitoTipLamports;

    const cappedJitoTip = Math.min(jitoTip, this.maxJitoTipLamports);
    this.logger.debug({ cappedJitoTip }, "using jito tip of");

    let priceFeedUpdateData: string[];
    try {
      const response = await this.hermesClient.getLatestPriceUpdates(priceIds, {
        encoding: "base64",
      });
      priceFeedUpdateData = response.binary.data;
    } catch (error: unknown) {
      this.logger.error(error, "getPriceFeedsUpdateData failed");
      return;
    }

    for (let i = 0; i < priceIds.length; i += this.updatesPerJitoBundle) {
      const transactionBuilder = this.pythSolanaReceiver.newTransactionBuilder(
        {
          closeUpdateAccounts: true,
        },
        this.addressLookupTableAccount,
      );
      await transactionBuilder.addUpdatePriceFeed(
        priceFeedUpdateData.map((x) => {
          return sliceAccumulatorUpdateData(
            Buffer.from(x, "base64"),
            i,
            i + this.updatesPerJitoBundle,
          ).toString("base64");
        }),
        this.shardId,
      );

      const transactions = await transactionBuilder.buildVersionedTransactions({
        jitoTipLamports: cappedJitoTip,
        tightComputeBudget: true,
      });

      try {
        await sendTransactionsJito(
          transactions,
          this.searcherClients,
          this.pythSolanaReceiver.wallet,
          {
            maxRetryTimeMs: this.maxRetryTimeMs,
          },
          this.logger,
        );
      } catch (error: unknown) {
        // The failed bundle's create instructions may have landed before the
        // bundle dropped; reclaim their rent, then keep the original error
        // propagation the caller already relies on.
        await closeStaleEncodedVaas(this.pythSolanaReceiver, this.logger, {
          tightComputeBudget: true,
        });
        throw error;
      }
    }
  }
}
