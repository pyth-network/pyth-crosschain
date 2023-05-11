import {
  ChainPriceListener,
  IPricePusher,
  PriceInfo,
  PriceItem,
} from "../interface";
import { AptosAccount, AptosClient, TxnBuilderTypes } from "aptos";
import { DurationInSeconds } from "../utils";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { PushAttempt } from "../common";

export class AptosPriceListener extends ChainPriceListener {
  constructor(
    private pythModule: string,
    private endpoint: string,
    priceItems: PriceItem[],
    config: {
      pollingFrequency: DurationInSeconds;
    }
  ) {
    super("aptos", config.pollingFrequency, priceItems);
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const client = new AptosClient(this.endpoint);

      const res = await client.getAccountResource(
        this.pythModule,
        `${this.pythModule}::state::LatestPriceInfo`
      );

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const handle = res.data.info.handle;

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

      console.log(
        `Polled an Aptos on-chain price for feed ${this.priceIdToAlias.get(
          priceId
        )} (${priceId}).`
      );

      return {
        price: price.toString(),
        conf: priceItemRes.price_feed.price.conf,
        publishTime: Number(priceItemRes.price_feed.price.timestamp),
      };
    } catch (e) {
      console.error(
        `Polling Aptos on-chain price for ${priceId} failed. Error:`
      );
      console.error(e);
      return undefined;
    }
  }
}

export class AptosPricePusher implements IPricePusher {
  private lastPushAttempt: PushAttempt | undefined;

  private readonly accountHDPath = "m/44'/637'/0'/0'/0'";
  constructor(
    private priceServiceConnection: PriceServiceConnection,
    private pythContractAddress: string,
    private endpoint: string,
    private mnemonic: string,
    private overrideGasPriceMultiplier: number
  ) {}

  /**
   * Gets price update data which then can be submitted to the Pyth contract to update the prices.
   * This will throw an axios error if there is a network problem or the price service returns a non-ok response (e.g: Invalid price ids)
   *
   * @param priceIds Array of hex-encoded price ids.
   * @returns Array of price update data.
   */
  async getPriceFeedsUpdateData(priceIds: string[]): Promise<number[][]> {
    // Fetch the latest price feed update VAAs from the price service
    const latestVaas = await this.priceServiceConnection.getLatestVaas(
      priceIds
    );
    return latestVaas.map((vaa) => Array.from(Buffer.from(vaa, "base64")));
  }

  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[]
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
    } catch (e) {
      console.error("Error fetching the latest vaas to push");
      console.error(e);
      return;
    }

    try {
      const account = AptosAccount.fromDerivePath(
        this.accountHDPath,
        this.mnemonic
      );
      const client = new AptosClient(this.endpoint);

      const rawTx = await client.generateTransaction(account.address(), {
        function: `${this.pythContractAddress}::pyth::update_price_feeds_if_fresh_with_funder`,
        type_arguments: [],
        arguments: [
          priceFeedUpdateData,
          priceIds.map((priceId) => Buffer.from(priceId, "hex")),
          pubTimesToPush,
        ],
      });

      const simulation = await client.simulateTransaction(account, rawTx, {
        estimateGasUnitPrice: true,
        estimateMaxGasAmount: true,
        estimatePrioritizedGasUnitPrice: true,
      });

      // Transactions on Aptos can be prioritized by paying a higher gas unit price.
      // We are storing the gas unit price paid for the last transaction.
      // If that transaction is not added to the block, we are increasing the gas unit price
      // by multiplying the old gas unit price with `this.overrideGasPriceMultiplier`.
      // After which we are sending a transaction with the same sequence number as the last
      // transaction. Since they have the same sequence number only one of them will be added to
      // the block and we won't be paying fees twice.
      let gasUnitPrice = Number(simulation[0].gas_unit_price);
      if (this.lastPushAttempt !== undefined) {
        if (
          Number(simulation[0].sequence_number) > this.lastPushAttempt.nonce
        ) {
          this.lastPushAttempt === undefined;
        } else {
          const newGasUnitPrice = Number(
            this.lastPushAttempt.gasPrice * this.overrideGasPriceMultiplier
          );
          if (gasUnitPrice < newGasUnitPrice) gasUnitPrice = newGasUnitPrice;
        }
      }

      const gasUsed = Number(simulation[0].gas_used) * 1.5;
      const maxGasAmount = Number(gasUnitPrice * gasUsed);

      const rawTxWithFee = new TxnBuilderTypes.RawTransaction(
        rawTx.sender,
        rawTx.sequence_number,
        rawTx.payload,
        BigInt(maxGasAmount.toFixed()),
        BigInt(gasUnitPrice.toFixed()),
        rawTx.expiration_timestamp_secs,
        rawTx.chain_id
      );

      const signedTx = await client.signTransaction(account, rawTxWithFee);
      const pendingTx = await client.submitTransaction(signedTx);

      console.log("Succesfully broadcasted txHash:", pendingTx.hash);

      // Update lastAttempt
      this.lastPushAttempt = {
        nonce: Number(pendingTx.sequence_number),
        gasPrice: gasUnitPrice,
      };
      return;
    } catch (e: any) {
      console.error("Error executing messages");
      console.log(e);
      return;
    }
  }
}
