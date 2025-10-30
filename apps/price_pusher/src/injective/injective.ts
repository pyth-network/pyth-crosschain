/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Msgs, Account, TxResponse } from "@injectivelabs/sdk-ts";
import {
  PrivateKey,
  TxGrpcApi,
  ChainGrpcAuthApi,
  ChainGrpcWasmApi,
  MsgExecuteContract,
  createTransactionFromMsg,
} from "@injectivelabs/sdk-ts";
import { splitArrayToChunks } from "@injectivelabs/utils";
import type { HexString } from "@pythnetwork/hermes-client";
import { HermesClient } from "@pythnetwork/hermes-client";
import type { Logger } from "pino";

import type { PriceItem, PriceInfo, IPricePusher } from "../interface.js";
import { ChainPriceListener } from "../interface.js";
import type { DurationInSeconds } from "../utils.js";

const DEFAULT_GAS_PRICE = 160_000_000;
const DEFAULT_GAS_MULTIPLIER = 1.05;
const DEFAULT_PRICE_IDS_PROCESS_CHUNK_SIZE = -1;
const INJECTIVE_TESTNET_CHAIN_ID = "injective-888";

type PriceQueryResponse = {
  price_feed: {
    id: string;
    price: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    };
  };
};

type InjectiveConfig = {
  chainId: string;
  gasMultiplier: number;
  gasPrice: number;
  priceIdsProcessChunkSize: number;
};

// this use price without leading 0x
export class InjectivePriceListener extends ChainPriceListener {
  constructor(
    private pythContractAddress: string,
    private grpcEndpoint: string,
    priceItems: PriceItem[],
    private logger: Logger,
    config: {
      pollingFrequency: DurationInSeconds;
    },
  ) {
    super(config.pollingFrequency, priceItems);
  }

  async getOnChainPriceInfo(
    priceId: HexString,
  ): Promise<PriceInfo | undefined> {
    let priceQueryResponse: PriceQueryResponse;
    try {
      const api = new ChainGrpcWasmApi(this.grpcEndpoint);
      const { data } = await api.fetchSmartContractState(
        this.pythContractAddress,
        Buffer.from(`{"price_feed":{"id":"${priceId}"}}`).toString("base64"),
      );

      const json = Buffer.from(data).toString();
      priceQueryResponse = JSON.parse(json);
    } catch (error) {
      this.logger.error(error, `Polling on-chain price for ${priceId} failed.`);
      return undefined;
    }

    this.logger.debug(
      `Polled an Injective on chain price for feed ${this.priceIdToAlias.get(
        priceId,
      )} (${priceId}).`,
    );

    return {
      conf: priceQueryResponse.price_feed.price.conf,
      price: priceQueryResponse.price_feed.price.price,
      publishTime: priceQueryResponse.price_feed.price.publish_time,
    };
  }
}

export class InjectivePricePusher implements IPricePusher {
  private mnemonic: string;
  private chainConfig: InjectiveConfig;
  private accounts: Record<string, Account | undefined> = {};

  constructor(
    private hermesClient: HermesClient,
    private pythContractAddress: string,
    private grpcEndpoint: string,
    private logger: Logger,
    mnemonic: string,
    chainConfig?: Partial<InjectiveConfig>,
  ) {
    this.mnemonic = mnemonic;
    this.chainConfig = {
      chainId: chainConfig?.chainId ?? INJECTIVE_TESTNET_CHAIN_ID,
      gasMultiplier: chainConfig?.gasMultiplier ?? DEFAULT_GAS_MULTIPLIER,
      gasPrice: chainConfig?.gasPrice ?? DEFAULT_GAS_PRICE,
      priceIdsProcessChunkSize:
        chainConfig?.priceIdsProcessChunkSize ??
        DEFAULT_PRICE_IDS_PROCESS_CHUNK_SIZE,
    };
  }

  private getWallet(index: number) {
    if (
      this.chainConfig.priceIdsProcessChunkSize === -1 ||
      this.chainConfig.priceIdsProcessChunkSize === undefined
    ) {
      return PrivateKey.fromMnemonic(this.mnemonic);
    }

    return PrivateKey.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/${index}`);
  }

  private async signAndBroadcastMsg(
    msg: Msgs,
    index: number,
  ): Promise<TxResponse> {
    const chainGrpcAuthApi = new ChainGrpcAuthApi(this.grpcEndpoint);
    const wallet = this.getWallet(index);
    const injectiveAddress = wallet.toAddress().toBech32();

    // Fetch the latest account details only if it's not stored.
    this.accounts[injectiveAddress] ??=
      await chainGrpcAuthApi.fetchAccount(injectiveAddress);

    const account = this.accounts[injectiveAddress];

    try {
      const { signBytes, txRaw } = createTransactionFromMsg({
        sequence: account.baseAccount.sequence,
        accountNumber: account.baseAccount.accountNumber,
        message: msg,
        chainId: this.chainConfig.chainId,
        fee: await this.getStdFee(msg, index),
        pubKey: wallet.toPublicKey().toBase64(),
      });

      // eslint-disable-next-line @typescript-eslint/await-thenable
      const sig = await wallet.sign(Buffer.from(signBytes));

      /** Append Signatures */
      txRaw.signatures = [sig];

      // this takes approx 5 seconds
      const txResponse = await new TxGrpcApi(this.grpcEndpoint).broadcast(
        txRaw,
      );

      account.baseAccount.sequence++;

      return txResponse;
    } catch (error: any) {
      // The sequence number was invalid and hence we will have to fetch it again
      if (/account sequence mismatch/.exec(JSON.stringify(error)) !== null) {
        this.accounts[injectiveAddress] = undefined;
      }

      throw error;
    }
  }

  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: number[],
  ): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    if (priceIds.length !== pubTimesToPush.length)
      throw new Error("Invalid arguments");

    const priceIdChunks =
      this.chainConfig.priceIdsProcessChunkSize === -1
        ? [priceIds]
        : splitArrayToChunks({
            array: priceIds,
            chunkSize: Number(this.chainConfig.priceIdsProcessChunkSize),
          });

    await Promise.all(
      priceIdChunks.map((priceIdChunk, chunkIndex) =>
        this.updatePriceFeedChunk(priceIdChunk, chunkIndex),
      ),
    );
  }

  private async updatePriceFeedChunk(
    priceIds: string[],
    chunkIndex: number,
  ): Promise<void> {
    try {
      const priceFeedUpdateObject =
        await this.getPriceFeedUpdateObject(priceIds);
      const updateFeeQueryResponse = await this.getUpdateFee(
        priceFeedUpdateObject.update_price_feeds.data,
      );
      const wallet = this.getWallet(chunkIndex);

      const msg = MsgExecuteContract.fromJSON({
        sender: wallet.toAddress().toBech32(),
        contractAddress: this.pythContractAddress,
        msg: priceFeedUpdateObject,
        funds: [updateFeeQueryResponse],
      });

      const rs = await this.signAndBroadcastMsg(msg, chunkIndex);

      this.logger.info(
        { hash: rs.txHash },
        `Successfully broadcasted txHash for chunk ${chunkIndex}`,
      );
    } catch (error: any) {
      if (error.message.match(/account inj[a-zA-Z0-9]+ not found/) !== null) {
        this.logger.error(error, `Account not found for chunk ${chunkIndex}`);

        throw new Error("Please check the mnemonic");
      }

      if (
        error.message.match(/insufficient/) !== null &&
        error.message.match(/funds/) !== null
      ) {
        this.logger.error(error, `Insufficient funds for chunk ${chunkIndex}`);
        throw new Error("Insufficient funds");
      }

      this.logger.error(
        error,
        `Error executing messages for chunk ${chunkIndex}`,
      );
    }
  }

  /**
   * Get the fee for the transaction (using simulation).
   *
   * We also apply a multiplier to the gas used to apply a small
   * buffer to the gas that'll be used.
   */
  private async getStdFee(msg: Msgs, index: number) {
    const wallet = this.getWallet(index);
    const injectiveAddress = wallet.toAddress().toBech32();
    const account = this.accounts[injectiveAddress];

    if (!account) {
      throw new Error("Account not found");
    }

    const { txRaw: simulateTxRaw } = createTransactionFromMsg({
      sequence: account.baseAccount.sequence,
      accountNumber: account.baseAccount.accountNumber,
      message: msg,
      chainId: this.chainConfig.chainId,
      pubKey: wallet.toPublicKey().toBase64(),
    });

    try {
      const result = await new TxGrpcApi(this.grpcEndpoint).simulate(
        simulateTxRaw,
      );

      const gas = (
        result.gasInfo.gasUsed * this.chainConfig.gasMultiplier
      ).toFixed(0);
      const fee = {
        amount: [
          {
            denom: "inj",
            amount: (Number(gas) * this.chainConfig.gasPrice).toFixed(0),
          },
        ],
        gas,
      };

      return fee;
    } catch (error) {
      this.logger.error(error, `Error getting std fee`);
      throw error;
    }
  }

  /**
   * Get the latest VAAs for updatePriceFeed and then push them
   */
  private async getPriceFeedUpdateObject(priceIds: string[]) {
    try {
      const response = await this.hermesClient.getLatestPriceUpdates(priceIds, {
        encoding: "base64",
        ignoreInvalidPriceIds: true,
      });
      const vaas = response.binary.data;

      return {
        update_price_feeds: {
          data: vaas,
        },
      } as {
        update_price_feeds: {
          data: string[];
        };
      };
    } catch (error) {
      this.logger.error(error, `Error fetching the latest vaas to push`);
      throw error;
    }
  }

  /**
   * Get the update fee for the given VAAs (i.e the fee that is paid to the pyth contract)
   */
  private async getUpdateFee(vaas: string[]) {
    try {
      const api = new ChainGrpcWasmApi(this.grpcEndpoint);
      const { data } = await api.fetchSmartContractState(
        this.pythContractAddress,
        Buffer.from(
          JSON.stringify({
            get_update_fee: {
              vaas,
            },
          }),
        ).toString("base64"),
      );

      const json = Buffer.from(data).toString();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return JSON.parse(json);
    } catch (error) {
      this.logger.error(error, `Error fetching update fee.`);

      // Throwing an error because it is likely an RPC issue
      throw error;
    }
  }
}
