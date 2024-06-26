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
import { Logger } from "pino";

export class SolanaPriceListener extends ChainPriceListener {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private shardId: number,
    priceItems: PriceItem[],
    private logger: Logger,
    config: {
      pollingFrequency: DurationInSeconds;
    }
  ) {
    super(config.pollingFrequency, priceItems);
  }

  // Checking the health of the Solana connection by checking the last block time
  // and ensuring it is not older than 30 seconds.
  private async checkHealth() {
    const slot = await this.pythSolanaReceiver.connection.getSlot();
    const blockTime = await this.pythSolanaReceiver.connection.getBlockTime(
      slot
    );
    if (blockTime === null || blockTime < Date.now() / 1000 - 30) {
      throw new Error("Solana connection is unhealthy");
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
          Buffer.from(priceId, "hex")
        );
      this.logger.debug(
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
    } catch (err) {
      this.logger.error({ err, priceId }, `Polling on-chain price failed.`);
      return undefined;
    }
  }
}

export class SolanaPricePusher implements IPricePusher {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private priceServiceConnection: PriceServiceConnection,
    private logger: Logger,
    private shardId: number,
    private computeUnitPriceMicroLamports: number
  ) {}

  async updatePriceFeed(
    priceIds: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _pubTimesToPush: number[]
  ): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    let priceFeedUpdateData;
    try {
      priceFeedUpdateData = await this.priceServiceConnection.getLatestVaas(
        priceIds
      );
    } catch (err: any) {
      this.logger.error(err, "getPriceFeedsUpdateData failed:");
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
      const signatures = await sendTransactions(
        transactions,
        this.pythSolanaReceiver.connection,
        this.pythSolanaReceiver.wallet
      );
      this.logger.info({ signatures }, "updatePriceFeed successful");
    } catch (err: any) {
      this.logger.error(err, "updatePriceFeed failed");
      return;
    }
  }
}

const UPDATES_PER_JITO_BUNDLE = 7;

export class SolanaPricePusherJito implements IPricePusher {
  constructor(
    private pythSolanaReceiver: PythSolanaReceiver,
    private priceServiceConnection: PriceServiceConnection,
    private logger: Logger,
    private shardId: number,
    private jitoTipLamports: number,
    private searcherClient: SearcherClient,
    private jitoBundleSize: number
  ) {}

  async updatePriceFeed(
    priceIds: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _pubTimesToPush: number[]
  ): Promise<void> {
    let priceFeedUpdateData: string[];
    try {
      priceFeedUpdateData = await this.priceServiceConnection.getLatestVaas(
        priceIds
      );
    } catch (err: any) {
      this.logger.error(err, "getPriceFeedsUpdateData failed");
      return;
    }

    for (let i = 0; i < priceIds.length; i += UPDATES_PER_JITO_BUNDLE) {
      const transactionBuilder = this.pythSolanaReceiver.newTransactionBuilder({
        closeUpdateAccounts: true,
      });
      await transactionBuilder.addUpdatePriceFeed(
        priceFeedUpdateData.map((x) => {
          return sliceAccumulatorUpdateData(
            Buffer.from(x, "base64"),
            i,
            i + UPDATES_PER_JITO_BUNDLE
          ).toString("base64");
        }),
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
