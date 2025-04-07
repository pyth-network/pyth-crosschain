import { HexString, HermesClient } from "@pythnetwork/hermes-client";
import {
  IPricePusher,
  PriceInfo,
  ChainPriceListener,
  PriceItem,
} from "../interface";
import { DurationInSeconds } from "../utils";
import {
  Msgs,
  Account,
  TxResponse,
  PrivateKey,
  TxGrpcApi,
  ChainGrpcAuthApi,
  ChainGrpcWasmApi,
  MsgExecuteContract,
  createTransactionFromMsg,
} from "@injectivelabs/sdk-ts";
import { splitArrayToChunks } from "@injectivelabs/utils";
import { Logger } from "pino";

const DEFAULT_GAS_PRICE = 160000000;
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

type UpdateFeeResponse = {
  denom: string;
  amount: string;
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
    } catch (err) {
      this.logger.error(err, `Polling on-chain price for ${priceId} failed.`);
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

type InjectiveConfig = {
  chainId: string;
  gasMultiplier: number;
  gasPrice: number;
  priceIdsProcessChunkSize: number;
};
export class InjectivePricePusher implements IPricePusher {
  private wallet: PrivateKey;
  private chainConfig: InjectiveConfig;
  private account: Account | null = null;

  constructor(
    private hermesClient: HermesClient,
    private pythContractAddress: string,
    private grpcEndpoint: string,
    private logger: Logger,
    mnemonic: string,
    chainConfig?: Partial<InjectiveConfig>,
  ) {
    this.wallet = PrivateKey.fromMnemonic(mnemonic);

    this.chainConfig = {
      chainId: chainConfig?.chainId ?? INJECTIVE_TESTNET_CHAIN_ID,
      gasMultiplier: chainConfig?.gasMultiplier ?? DEFAULT_GAS_MULTIPLIER,
      gasPrice: chainConfig?.gasPrice ?? DEFAULT_GAS_PRICE,
      priceIdsProcessChunkSize:
        chainConfig?.priceIdsProcessChunkSize ??
        DEFAULT_PRICE_IDS_PROCESS_CHUNK_SIZE,
    };
  }

  private injectiveAddress(): string {
    return this.wallet.toBech32();
  }

  private async signAndBroadcastMsg(msg: Msgs): Promise<TxResponse> {
    const chainGrpcAuthApi = new ChainGrpcAuthApi(this.grpcEndpoint);

    // Fetch the latest account details only if it's not stored.
    this.account ??= await chainGrpcAuthApi.fetchAccount(
      this.injectiveAddress(),
    );

    const { txRaw: simulateTxRaw } = createTransactionFromMsg({
      sequence: this.account.baseAccount.sequence,
      accountNumber: this.account.baseAccount.accountNumber,
      message: msg,
      chainId: this.chainConfig.chainId,
      pubKey: this.wallet.toPublicKey().toBase64(),
    });

    const txService = new TxGrpcApi(this.grpcEndpoint);
    // simulation
    try {
      const {
        gasInfo: { gasUsed },
      } = await txService.simulate(simulateTxRaw);

      // simulation returns us the approximate gas used
      // gas passed with the transaction should be more than that
      // in order for it to be successfully executed
      // this multiplier takes care of that
      const gas = (gasUsed * this.chainConfig.gasMultiplier).toFixed();
      const fee = {
        amount: [
          {
            denom: "inj",
            amount: (Number(gas) * this.chainConfig.gasPrice).toFixed(),
          },
        ],
        gas,
      };

      const { signBytes, txRaw } = createTransactionFromMsg({
        sequence: this.account.baseAccount.sequence,
        accountNumber: this.account.baseAccount.accountNumber,
        message: msg,
        chainId: this.chainConfig.chainId,
        fee,
        pubKey: this.wallet.toPublicKey().toBase64(),
      });

      const sig = await this.wallet.sign(Buffer.from(signBytes));

      this.account.baseAccount.sequence++;

      /** Append Signatures */
      txRaw.signatures = [sig];
      // this takes approx 5 seconds
      const txResponse = await txService.broadcast(txRaw);

      return txResponse;
    } catch (e: any) {
      // The sequence number was invalid and hence we will have to fetch it again.
      if (JSON.stringify(e).match(/account sequence mismatch/) !== null) {
        // We need to fetch the account details again.
        this.account = null;
      }
      throw e;
    }
  }

  async getPriceFeedUpdateObject(priceIds: string[]): Promise<any> {
    const response = await this.hermesClient.getLatestPriceUpdates(priceIds, {
      encoding: "base64",
    });
    const vaas = response.binary.data;

    return {
      update_price_feeds: {
        data: vaas,
      },
    };
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

    for (const [chunkIndex, priceIdChunk] of priceIdChunks.entries()) {
      await this.updatePriceFeedChunk(priceIdChunk, chunkIndex);
    }
  }

  private async updatePriceFeedChunk(
    priceIds: string[],
    chunkIndex: number,
  ): Promise<void> {
    let priceFeedUpdateObject;

    try {
      // get the latest VAAs for updatePriceFeed and then push them
      priceFeedUpdateObject = await this.getPriceFeedUpdateObject(priceIds);
    } catch (err) {
      this.logger.error(
        err,
        `Error fetching the latest vaas to push for chunk ${chunkIndex}`,
      );
      return;
    }

    let updateFeeQueryResponse: UpdateFeeResponse;
    try {
      const api = new ChainGrpcWasmApi(this.grpcEndpoint);
      const { data } = await api.fetchSmartContractState(
        this.pythContractAddress,
        Buffer.from(
          JSON.stringify({
            get_update_fee: {
              vaas: priceFeedUpdateObject.update_price_feeds.data,
            },
          }),
        ).toString("base64"),
      );

      const json = Buffer.from(data).toString();
      updateFeeQueryResponse = JSON.parse(json);
    } catch (err) {
      this.logger.error(
        err,
        `Error fetching update fee for chunk ${chunkIndex}`,
      );
      // Throwing an error because it is likely an RPC issue
      throw err;
    }

    try {
      const executeMsg = MsgExecuteContract.fromJSON({
        sender: this.injectiveAddress(),
        contractAddress: this.pythContractAddress,
        msg: priceFeedUpdateObject,
        funds: [updateFeeQueryResponse],
      });

      const rs = await this.signAndBroadcastMsg(executeMsg);
      this.logger.info(
        { hash: rs.txHash },
        `Successfully broadcasted txHash for chunk ${chunkIndex}`,
      );
    } catch (err: any) {
      if (err.message.match(/account inj[a-zA-Z0-9]+ not found/) !== null) {
        this.logger.error(err, `Account not found for chunk ${chunkIndex}`);
        throw new Error("Please check the mnemonic");
      }

      if (
        err.message.match(/insufficient/) !== null &&
        err.message.match(/funds/) !== null
      ) {
        this.logger.error(err, `Insufficient funds for chunk ${chunkIndex}`);
        throw new Error("Insufficient funds");
      }
      this.logger.error(
        err,
        `Error executing messages for chunk ${chunkIndex}`,
      );
    }
  }
}
