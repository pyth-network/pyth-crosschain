import {
  HexString,
  PriceServiceConnection,
} from "@pythnetwork/price-service-client";
import {
  ChainPricePusher,
  PriceInfo,
  ChainPriceListener,
  PriceItem,
} from "../interface";
import { DurationInSeconds } from "../utils";
import {
  ChainGrpcAuthApi,
  ChainGrpcWasmApi,
  DEFAULT_STD_FEE,
  MsgExecuteContract,
  Msgs,
  PrivateKey,
  TxGrpcClient,
  TxResponse,
  createTransactionFromMsg,
} from "@injectivelabs/sdk-ts";

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
    config: {
      pollingFrequency: DurationInSeconds;
    }
  ) {
    super("Injective", config.pollingFrequency, priceItems);
  }

  async getOnChainPriceInfo(
    priceId: HexString
  ): Promise<PriceInfo | undefined> {
    let priceQueryResponse: PriceQueryResponse;
    try {
      const api = new ChainGrpcWasmApi(this.grpcEndpoint);
      const { data } = await api.fetchSmartContractState(
        this.pythContractAddress,
        Buffer.from(`{"price_feed":{"id":"${priceId}"}}`).toString("base64")
      );

      const json = Buffer.from(data as string, "base64").toString();
      priceQueryResponse = JSON.parse(json);
    } catch (e) {
      console.error(`Polling on-chain price for ${priceId} failed. Error:`);
      console.error(e);
      return undefined;
    }

    console.log(
      `Polled an Injective on chain price for feed ${this.priceIdToAlias.get(
        priceId
      )} (${priceId}).`
    );

    return {
      conf: priceQueryResponse.price_feed.price.conf,
      price: priceQueryResponse.price_feed.price.price,
      publishTime: priceQueryResponse.price_feed.price.publish_time,
    };
  }
}

export class InjectivePricePusher implements ChainPricePusher {
  private wallet: PrivateKey;
  constructor(
    private priceServiceConnection: PriceServiceConnection,
    private pythContractAddress: string,
    private grpcEndpoint: string,
    mnemonic: string
  ) {
    this.wallet = PrivateKey.fromMnemonic(mnemonic);
  }

  private injectiveAddress(): string {
    return this.wallet.toBech32();
  }

  private async signAndBroadcastMsg(
    msg: Msgs,
    fee = DEFAULT_STD_FEE
  ): Promise<TxResponse> {
    const chainGrpcAuthApi = new ChainGrpcAuthApi(this.grpcEndpoint);
    const account = await chainGrpcAuthApi.fetchAccount(
      this.injectiveAddress()
    );
    const { signBytes, txRaw } = createTransactionFromMsg({
      sequence: account.baseAccount.sequence,
      accountNumber: account.baseAccount.accountNumber,
      message: msg,
      chainId: "injective-888",
      fee,
      pubKey: this.wallet.toPublicKey().toBase64(),
    });

    const sig = await this.wallet.sign(Buffer.from(signBytes));

    /** Append Signatures */
    txRaw.setSignaturesList([sig]);

    const txService = new TxGrpcClient(this.grpcEndpoint);
    const txResponse = await txService.broadcast(txRaw);

    return txResponse;
  }

  async getPriceFeedUpdateObject(priceIds: string[]): Promise<any> {
    const vaas = await this.priceServiceConnection.getLatestVaas(priceIds);

    return {
      update_price_feeds: {
        data: vaas,
      },
    };
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

    let priceFeedUpdateObject;
    try {
      // get the latest VAAs for updatePriceFeed and then push them
      priceFeedUpdateObject = await this.getPriceFeedUpdateObject(priceIds);
    } catch (e) {
      console.error("Error fetching the latest vaas to push");
      console.error(e);
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
          })
        ).toString("base64")
      );

      const json = Buffer.from(data as string, "base64").toString();
      updateFeeQueryResponse = JSON.parse(json);
    } catch (e) {
      console.error("Error fetching update fee");
      console.error(e);
      return;
    }

    try {
      const executeMsg = MsgExecuteContract.fromJSON({
        sender: this.injectiveAddress(),
        contractAddress: this.pythContractAddress,
        msg: priceFeedUpdateObject,
        funds: [updateFeeQueryResponse],
      });

      const rs = await this.signAndBroadcastMsg(executeMsg);

      if (rs.code !== 0) throw new Error("Error: transaction failed");

      console.log("Succesfully broadcasted txHash:", rs.txHash);
    } catch (e) {
      console.error("Error executing messages");
      console.log(e);
    }
  }
}
