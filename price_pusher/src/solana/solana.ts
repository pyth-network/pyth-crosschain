import { ChainPriceListener, IPricePusher, PriceInfo } from "../interface";

export class SolanaPriceListener extends ChainPriceListener {
  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    console.log(
      `Polled a Solana on chain price for feed ${this.priceIdToAlias.get(
        priceId
      )} (${priceId}).`
    );

    return undefined;
  }
}

export class SolanaPricePusher implements IPricePusher {
  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[]
  ): Promise<void> {
    console.log("successful");
  }
}
