import {
  HexString,
  PriceServiceConnection,
  PriceServiceConnectionConfig,
} from "@pythnetwork/pyth-common-js";
import { ChainPricePusher, PriceInfo, PriceListener } from "./interface";
import { DurationInSeconds } from "./utils";
import { PriceConfig } from "./price-config";
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
// FIXME: implement common methods in the parent class
export class InjectivePriceListener implements PriceListener {
  private latestPriceInfo: Map<HexString, PriceInfo>;
  private priceIds: HexString[];

  private pollingFrequency: DurationInSeconds;

  constructor(
    private contractAddress: string,
    private grpcEndpoint: string,
    priceConfigs: PriceConfig[],
    config: {
      pollingFrequency: DurationInSeconds;
    }
  ) {
    this.latestPriceInfo = new Map();
    this.priceIds = priceConfigs.map((priceConfig) => priceConfig.id);

    this.pollingFrequency = config.pollingFrequency;
  }

  async start() {
    console.log(`Polling the prices every ${this.pollingFrequency} seconds...`);
    setInterval(this.pollPrices.bind(this), this.pollingFrequency * 1000);

    await this.pollPrices();
  }

  private async pollPrices() {
    console.log("Polling injective prices...");
    for (const priceId of this.priceIds) {
      const currentPriceInfo = await this.getOnChainPriceInfo(priceId);
      if (currentPriceInfo !== undefined) {
        this.updateLatestPriceInfo(priceId, currentPriceInfo);
      }
    }
  }

  async getOnChainPriceInfo(
    priceId: HexString
  ): Promise<PriceInfo | undefined> {
    let priceQueryResponse: PriceQueryResponse;
    try {
      const api = new ChainGrpcWasmApi(this.grpcEndpoint);
      const { data } = await api.fetchSmartContractState(
        this.contractAddress,
        Buffer.from(`{"price_feed":{"id":"${priceId}"}}`).toString("base64")
      );

      const json = Buffer.from(data as string, "base64").toString();
      priceQueryResponse = JSON.parse(json);
    } catch (e) {
      console.error(`Getting on-chain price for ${priceId} failed. Error:`);
      console.error(e);
      return undefined;
    }

    return {
      conf: priceQueryResponse.price_feed.price.conf,
      price: priceQueryResponse.price_feed.price.price,
      publishTime: priceQueryResponse.price_feed.price.publish_time,
    };
  }

  private updateLatestPriceInfo(priceId: HexString, observedPrice: PriceInfo) {
    const cachedLatestPriceInfo = this.getLatestPriceInfo(priceId);

    // Ignore the observed price if the cache already has newer
    // price. This could happen because we are using polling and
    // subscription at the same time.
    if (
      cachedLatestPriceInfo !== undefined &&
      cachedLatestPriceInfo.publishTime > observedPrice.publishTime
    ) {
      return;
    }

    this.latestPriceInfo.set(priceId, observedPrice);
  }

  getLatestPriceInfo(priceId: string): PriceInfo | undefined {
    return this.latestPriceInfo.get(priceId);
  }
}

export class InjectivePricePusher implements ChainPricePusher {
  private wallet: PrivateKey;
  constructor(
    private cwPriceServiceConnection: CwPriceServiceConnection,
    private pythContract: string,
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
      priceFeedUpdateObject =
        await this.cwPriceServiceConnection.getPriceFeedUpdateObject(priceIds);
    } catch (e) {
      console.error("Error fetching the latest vaas to push");
      console.error(e);
      return;
    }

    let updateFeeQueryResponse: UpdateFeeResponse;
    try {
      const api = new ChainGrpcWasmApi(this.grpcEndpoint);
      const { data } = await api.fetchSmartContractState(
        this.pythContract,
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

    // TODO: add specific error messages
    try {
      const executeMsg = MsgExecuteContract.fromJSON({
        sender: this.injectiveAddress(),
        contractAddress: this.pythContract,
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

// FIXME: a better place for it while refactoring
export class CwPriceServiceConnection extends PriceServiceConnection {
  constructor(endpoint: string, config?: PriceServiceConnectionConfig) {
    super(endpoint, config);
  }

  async getPriceFeedUpdateObject(priceIds: string[]): Promise<any> {
    const vaas = await this.getLatestVaas(priceIds);

    return {
      update_price_feeds: {
        data: vaas,
      },
    };
  }
}
