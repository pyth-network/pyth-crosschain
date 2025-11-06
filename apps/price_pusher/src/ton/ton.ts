/* eslint-disable @typescript-eslint/no-explicit-any */
import { HermesClient } from "@pythnetwork/hermes-client";
import {
  PythContract,
  calculateUpdatePriceFeedsFee,
} from "@pythnetwork/pyth-ton-js";
import { keyPairFromSeed } from "@ton/crypto";
import type { ContractProvider, OpenedContract, Sender } from "@ton/ton";
import { Address, TonClient, WalletContractV4 } from "@ton/ton";
import type { Logger } from "pino";

import type { IPricePusher, PriceInfo, PriceItem } from "../interface.js";
import { ChainPriceListener } from "../interface.js";
import type { DurationInSeconds } from "../utils.js";
import { addLeading0x } from "../utils.js";

export class TonPriceListener extends ChainPriceListener {
  private contract: OpenedContract<PythContract>;

  constructor(
    private provider: ContractProvider,
    private contractAddress: Address,
    priceItems: PriceItem[],
    private logger: Logger,
    config: {
      pollingFrequency: DurationInSeconds;
    },
  ) {
    super(config.pollingFrequency, priceItems);
    this.contract = this.provider.open(
      PythContract.createFromAddress(this.contractAddress),
    );
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const formattedPriceId = addLeading0x(priceId);
      const priceInfo = await this.contract.getPriceUnsafe(formattedPriceId);

      this.logger.debug(
        `Polled a TON on chain price for feed ${
          this.priceIdToAlias.get(priceId) ?? ""
        } (${priceId}).`,
      );

      return {
        conf: priceInfo.conf.toString(),
        price: priceInfo.price.toString(),
        publishTime: priceInfo.publishTime,
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

export class TonPricePusher implements IPricePusher {
  private contract: OpenedContract<PythContract>;
  private sender: Sender;

  constructor(
    private client: TonClient,
    private privateKey: string,
    private contractAddress: Address,
    private hermesClient: HermesClient,
    private logger: Logger,
  ) {
    this.contract = this.client
      .provider(this.contractAddress)
      .open(PythContract.createFromAddress(this.contractAddress));
    const keyPair = keyPairFromSeed(Buffer.from(this.privateKey, "hex"));
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0, // workchain 0 is the masterchain
    });
    const provider = this.client.open(wallet);
    this.sender = provider.sender(keyPair.secretKey);
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

    try {
      for (const updateData of priceFeedUpdateData) {
        const updateDataBuffer = Buffer.from(updateData, "base64");
        const updateFee = await this.contract.getUpdateFee(updateDataBuffer);
        const totalFee =
          calculateUpdatePriceFeedsFee(BigInt(priceIds.length)) +
          BigInt(updateFee);

        await this.contract.sendUpdatePriceFeeds(
          this.sender,
          updateDataBuffer,
          totalFee,
        );
      }

      this.logger.info("updatePriceFeed successful");
    } catch (error: any) {
      this.logger.error(error, "updatePriceFeed failed");
    }
  }
}
