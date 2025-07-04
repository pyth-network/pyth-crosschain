import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import {
  ChainPriceListener,
  IPricePusher,
  PriceInfo,
  PriceItem,
} from "../interface";
import { DurationInSeconds } from "../utils";
import { HermesClient } from "@pythnetwork/hermes-client";
import {
  sendTransactions,
  sendTransactionsJito,
} from "@pythnetwork/solana-utils";
import { SearcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import { sliceAccumulatorUpdateData } from "@pythnetwork/price-service-sdk";
import { Logger } from "pino";
import { AddressLookupTableAccount, LAMPORTS_PER_SOL } from "@solana/web3.js";

const HEALTH_CHECK_TIMEOUT_SECONDS = 60;

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
        blockTime === null ||
        blockTime < Date.now() / 1000 - HEALTH_CHECK_TIMEOUT_SECONDS
      ) {
        if (blockTime !== null) {
          this.logger.info(
            `Solana connection is behind by ${
              Date.now() / 1000 - blockTime
            } seconds`,
          );
        }
      }
    } catch (err) {
      this.logger.error({ err }, "checkHealth failed");
    }
  }

  async start() {
    // Frequently check the RPC connection to ensure it is healthy
    setInterval(this.checkHealth.bind(this), 5000);

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
        `Polled a Solana on chain price for feed ${this.priceIdToAlias.get(
          priceId,
        )} (${priceId}).`,
      );
      if (priceFeedAccount) {
        return {
          conf: priceFeedAccount.priceMessage.conf.toString(),
          price: priceFeedAccount.priceMessage.price.toString(),
          publishTime: priceFeedAccount.priceMessage.publishTime.toNumber(),
        };
      } else {
        return undefined;
      }
    } catch (err) {
      this.logger.error({ err, priceId }, `Polling on-chain price failed.`);
      return undefined;
    }
  }
}

export class SolanaPricePusher implements IPricePusher {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private hermesClient: HermesClient,
    private logger: Logger,
    private shardId: number,
    private computeUnitPriceMicroLamports: number,
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
    } catch (err: any) {
      this.logger.error(err, "getPriceFeedsUpdateData failed:");
      return;
    }

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

    const transactions = await transactionBuilder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: this.computeUnitPriceMicroLamports,
      tightComputeBudget: true,
    });

    try {
      const signatures = await sendTransactions(
        transactions,
        this.pythSolanaReceiver.connection,
        this.pythSolanaReceiver.wallet,
      );
      this.logger.info({ signatures }, "updatePriceFeed successful");
    } catch (err: any) {
      this.logger.error(err, "updatePriceFeed failed");
      return;
    }
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
    private jitoBundleSize: number,
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
        this.logger.error(
          { status: response.status, statusText: response.statusText },
          "getRecentJitoTips http request failed",
        );
        return undefined;
      }
      const data = await response.json();
      return Math.floor(
        Number(data[0].landed_tips_50th_percentile) * LAMPORTS_PER_SOL,
      );
    } catch (err: any) {
      this.logger.error({ err }, "getRecentJitoTips failed");
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
    this.logger.info({ cappedJitoTip }, "using jito tip of");

    let priceFeedUpdateData: string[];
    try {
      const response = await this.hermesClient.getLatestPriceUpdates(priceIds, {
        encoding: "base64",
      });
      priceFeedUpdateData = response.binary.data;
    } catch (err: any) {
      this.logger.error(err, "getPriceFeedsUpdateData failed");
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
        jitoBundleSize: this.jitoBundleSize,
      });

      await sendTransactionsJito(
        transactions,
        this.searcherClients,
        this.pythSolanaReceiver.wallet,
        {
          maxRetryTimeMs: this.maxRetryTimeMs,
        },
        this.logger,
      );
    }
  }
}
