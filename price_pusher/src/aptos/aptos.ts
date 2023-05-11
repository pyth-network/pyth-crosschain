import {
  ChainPriceListener,
  IPricePusher,
  PriceInfo,
  PriceItem,
} from "../interface";
import { AptosClient } from "aptos";
import { DurationInSeconds } from "../utils";

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
  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[]
  ): Promise<void> {
    console.log("updating", priceIds);
  }
}
