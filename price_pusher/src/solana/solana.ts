import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import {
  ChainPriceListener,
  IPricePusher,
  PriceInfo,
  PriceItem,
} from "../interface";
import { DurationInSeconds } from "../utils";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";

export class SolanaPriceListener extends ChainPriceListener {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
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
          0,
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
    private priceServiceConnection: PriceServiceConnection
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
      closeUpdateAccounts: false,
    });
    transactionBuilder.addUpdatePriceFeed(priceFeedUpdateData);

    try {
      const transactionHashes = await this.pythSolanaReceiver.provider.sendAll(
        await transactionBuilder.buildVersionedTransactions({
          computeUnitPriceMicroLamports: 50000,
        }),
        { skipPreflight: true }
      );
      console.log(`updatePriceFeed succesful`);
    } catch (e: any) {
      console.error("updatePriceFeed failed");
      console.error(e);
      return;
    }
  }
}
