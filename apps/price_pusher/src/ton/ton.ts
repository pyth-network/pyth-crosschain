import { HermesClient } from "@pythnetwork/hermes-client";
import {
  ChainPriceListener,
  IPricePusher,
  PriceInfo,
  PriceItem,
} from "../interface";
import { addLeading0x, DurationInSeconds } from "../utils";
import { Logger } from "pino";
import {
  Address,
  ContractProvider,
  OpenedContract,
  Sender,
  TonClient,
  WalletContractV4,
} from "@ton/ton";
import { keyPairFromSeed } from "@ton/crypto";
import {
  PythContract,
  calculateUpdatePriceFeedsFee,
} from "@pythnetwork/pyth-ton-js";

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
        `Polled a TON on chain price for feed ${this.priceIdToAlias.get(
          priceId,
        )} (${priceId}).`,
      );

      return {
        conf: priceInfo.conf.toString(),
        price: priceInfo.price.toString(),
        publishTime: priceInfo.publishTime,
      };
    } catch (err) {
      this.logger.error({ err, priceId }, `Polling on-chain price failed.`);
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

  async updatePriceFeed(
    priceIds: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pubTimesToPush: number[],
  ): Promise<void> {
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
    } catch (err: any) {
      this.logger.error(err, "getPriceFeedsUpdateData failed");
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
    } catch (err: any) {
      this.logger.error(err, "updatePriceFeed failed");
    }
  }
}
