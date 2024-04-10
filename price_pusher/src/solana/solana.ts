import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import {
  ChainPriceListener,
  IPricePusher,
  PriceInfo,
  PriceItem,
} from "../interface";
import { DurationInSeconds } from "../utils";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { sendTransactions } from "@pythnetwork/solana-utils";

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
    private computeUnitPriceMicroLamports: number,
    private alreadySending: boolean = false
  ) {}

  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[]
  ): Promise<void> {
    if (this.alreadySending) {
      console.log(new Date(), "updatePriceFeed already in progress");
      return;
    }
    this.alreadySending = true;
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
        this.pythSolanaReceiver.wallet as any
      );
      console.log(new Date(), "updatePriceFeed successful");
      this.alreadySending = false;
    } catch (e: any) {
      console.error(new Date(), "updatePriceFeed failed", e);
      this.alreadySending = false;
      return;
    }
  }
}
