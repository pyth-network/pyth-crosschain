/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable no-console */
import { HermesClient } from "@pythnetwork/hermes-client";
import {
  PYTH_CONTRACT_ABI,
  FUEL_ETH_ASSET_ID,
} from "@pythnetwork/pyth-fuel-js";
import { Provider, Contract, hexlify, arrayify, Wallet, BN } from "fuels";
import type { Logger } from "pino";

import type { IPricePusher, PriceInfo, PriceItem } from "../interface.js";
import { ChainPriceListener } from "../interface.js";
import type { DurationInSeconds } from "../utils.js";
import { addLeading0x } from "../utils.js";

// Convert TAI64 timestamp to Unix timestamp
function tai64ToUnix(tai64: BN): number {
  // TAI64 is 2^62 seconds ahead of Unix epoch (1970-01-01)
  // Additional 10-second offset accounts for TAI being ahead of UTC at Unix epoch
  const result = BigInt(tai64.toString()) - BigInt(2n ** 62n) - 10n;
  return Number(result);
}

export class FuelPriceListener extends ChainPriceListener {
  private contract: Contract;

  constructor(
    private provider: Provider,
    private pythContractId: string,
    priceItems: PriceItem[],
    private logger: Logger,
    config: {
      pollingFrequency: DurationInSeconds;
    },
  ) {
    super(config.pollingFrequency, priceItems);
    this.contract = new Contract(
      this.pythContractId,
      PYTH_CONTRACT_ABI,
      this.provider,
    );
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const formattedPriceId = addLeading0x(priceId);
      const priceInfo = await this.contract.functions
        .price_unsafe?.(formattedPriceId)
        .get();

      console.log({
        conf: priceInfo?.value.confidence.toString(),
        price: priceInfo?.value.price.toString(),
        publishTime: tai64ToUnix(priceInfo?.value.publish_time),
      });

      this.logger.debug(
        `Polled a Fuel on chain price for feed ${this.priceIdToAlias.get(
          priceId,
        )} (${priceId}).`,
      );

      return {
        conf: priceInfo?.value.confidence.toString() ?? "",
        price: priceInfo?.value.price.toString() ?? "",
        publishTime: tai64ToUnix(priceInfo?.value.publish_time),
      };
    } catch (error) {
      this.logger.error(
        { err: error, priceId },
        `Polling on-chain price failed.`,
      );
      return undefined;
    }
  }
}

export class FuelPricePusher implements IPricePusher {
  private contract: Contract;

  constructor(
    private wallet: Wallet,
    private pythContractId: string,
    private hermesClient: HermesClient,
    private logger: Logger,
  ) {
    this.contract = new Contract(
      this.pythContractId,
      PYTH_CONTRACT_ABI,
      this.wallet as Provider,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updatePriceFeed(priceIds: string[], _: number[]): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    let priceFeedUpdateData: string[];
    try {
      const response = await this.hermesClient.getLatestPriceUpdates(priceIds, {
        encoding: "base64",
        ignoreInvalidPriceIds: true,
      });
      priceFeedUpdateData = response.binary.data;
    } catch (error: any) {
      this.logger.error(error, "getPriceFeedsUpdateData failed");
      return;
    }

    const updateData = priceFeedUpdateData.map((data) => arrayify(data));

    try {
      const updateFee = await this.contract.functions
        .update_fee?.(updateData)
        .get();

      const result = await this.contract.functions
        .update_price_feeds?.(updateData)
        .callParams({
          forward: [updateFee?.value, hexlify(FUEL_ETH_ASSET_ID)],
        })
        .call();

      this.logger.info(
        { transactionId: result?.transactionId },
        "updatePriceFeed successful",
      );
    } catch (error: any) {
      this.logger.error(error, "updatePriceFeed failed");
    }
  }
}
