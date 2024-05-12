import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import {
  ChainPriceListener,
  IPricePusher,
  PriceInfo,
  PriceItem,
} from "../interface";
import { DurationInSeconds } from "../utils";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import {
  sendTransactions,
  sendTransactionsJito,
} from "@pythnetwork/solana-utils";
import { SearcherClient } from "jito-ts/dist/sdk/block-engine/searcher";
import { sliceAccumulatorUpdateData } from "@pythnetwork/price-service-sdk";

export class SolanaPriceListener extends ChainPriceListener {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private shardId: number,
    priceItems: PriceItem[],
    config: {
      pollingFrequency: DurationInSeconds;
    }
  ) {
    super("solana", config.pollingFrequency, priceItems);
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const priceFeedAccount =
        await this.pythSolanaReceiver.fetchPriceFeedAccount(
          this.shardId,
          Buffer.from(priceId, "hex")
        );
      console.log(
        `Polled a Solana on chain price for feed ${this.priceIdToAlias.get(
          priceId
        )} (${priceId}).`
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
    } catch (e) {
      console.error(`Polling on-chain price for ${priceId} failed. Error:`);
      console.error(e);
      return undefined;
    }
  }
}

export class SolanaPricePusher implements IPricePusher {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private priceServiceConnection: PriceServiceConnection,
    private shardId: number,
    private computeUnitPriceMicroLamports: number
  ) {}

  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[]
  ): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    let priceFeedUpdateData;
    try {
      priceFeedUpdateData = await this.priceServiceConnection.getLatestVaas(
        priceIds
      );
    } catch (e: any) {
      console.error(new Date(), "getPriceFeedsUpdateData failed:", e);
      return;
    }

    const transactionBuilder = this.pythSolanaReceiver.newTransactionBuilder({
      closeUpdateAccounts: true,
    });
    await transactionBuilder.addUpdatePriceFeed(
      priceFeedUpdateData,
      this.shardId
    );

    const transactions = await transactionBuilder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: this.computeUnitPriceMicroLamports,
      tightComputeBudget: true,
    });

    try {
      await sendTransactions(
        transactions,
        this.pythSolanaReceiver.connection,
        this.pythSolanaReceiver.wallet
      );
      console.log(new Date(), "updatePriceFeed successful");
    } catch (e: any) {
      console.error(new Date(), "updatePriceFeed failed", e);
      return;
    }
  }
}

const UPDATES_PER_JITO_BUNDLE = 7;

export class SolanaPricePusherJito implements IPricePusher {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private priceServiceConnection: PriceServiceConnection,
    private shardId: number,
    private jitoTipLamports: number,
    private searcherClient: SearcherClient,
    private jitoBundleSize: number
  ) {}

  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[]
  ): Promise<void> {
    let priceFeedUpdateData: string[];
    try {
      priceFeedUpdateData = await this.priceServiceConnection.getLatestVaas(
        priceIds
      );
    } catch (e: any) {
      console.error(new Date(), "getPriceFeedsUpdateData failed:", e);
      return;
    }

    for (let i = 0; i < priceIds.length; i += UPDATES_PER_JITO_BUNDLE) {
      const transactionBuilder = this.pythSolanaReceiver.newTransactionBuilder({
        closeUpdateAccounts: true,
      });
      await transactionBuilder.addUpdatePriceFeed(
        [
          sliceAccumulatorUpdateData(
            Buffer.from(priceFeedUpdateData[0], "base64"),
            i,
            i + UPDATES_PER_JITO_BUNDLE
          ).toString("base64"),
        ],
        this.shardId
      );

      const transactions = await transactionBuilder.buildVersionedTransactions({
        jitoTipLamports: this.jitoTipLamports,
        tightComputeBudget: true,
        jitoBundleSize: this.jitoBundleSize,
      });

      await sendTransactionsJito(
        transactions,
        this.searcherClient,
        this.pythSolanaReceiver.wallet
      );
    }
  }
}
