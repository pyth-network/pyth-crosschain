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
      closeUpdateAccounts: false,
    });
    await transactionBuilder.addUpdatePriceFeed(
      priceFeedUpdateData,
      this.shardId
    );
    await transactionBuilder.addClosePreviousEncodedVaasInstructions();

    const transactions = await transactionBuilder.buildVersionedTransactions({
      jitoTipLamports: this.jitoTipLamports,
      tightComputeBudget: true,
      jitoBundleSize: this.jitoBundleSize,
    });

    const firstSignature = await sendTransactionsJito(
      transactions.slice(0, this.jitoBundleSize),
      this.searcherClient,
      this.pythSolanaReceiver.wallet
    );

    const blockhashResult =
      await this.pythSolanaReceiver.connection.getLatestBlockhashAndContext({
        commitment: "confirmed",
      });
    await this.pythSolanaReceiver.connection.confirmTransaction(
      {
        signature: firstSignature,
        blockhash: blockhashResult.value.blockhash,
        lastValidBlockHeight: blockhashResult.value.lastValidBlockHeight,
      },
      "confirmed"
    );

    for (
      let i = this.jitoBundleSize;
      i < transactions.length;
      i += this.jitoBundleSize
    ) {
      await sendTransactionsJito(
        transactions.slice(i, i + this.jitoBundleSize),
        this.searcherClient,
        this.pythSolanaReceiver.wallet
      );
    }
  }
}
