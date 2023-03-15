import {
  HexString,
  PriceServiceConnection,
} from "@pythnetwork/price-service-client";
import {
  IPricePusher,
  PriceInfo,
  ChainPriceListener,
  PriceItem,
} from "../interface";
import { DurationInSeconds } from "../utils";
import {
  ChainGrpcAuthApi,
  ChainGrpcWasmApi,
  MsgExecuteContract,
  Msgs,
  PrivateKey,
  TxGrpcClient,
  TxResponse,
  createTransactionFromMsg,
} from "@injectivelabs/sdk-ts";

import { DEFAULT_GAS_PRICE } from "@injectivelabs/utils";

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

type InjectiveConfig = {
  chainId: string;
  gasMultiplier: number;
  gasPrice: number;
};
export class InjectivePricePusher implements IPricePusher {
  private wallet: PrivateKey;
  private chainConfig: InjectiveConfig;

  constructor(
    private priceServiceConnection: PriceServiceConnection,
    private pythContractAddress: string,
    private grpcEndpoint: string,
    mnemonic: string,
    chainConfig?: Partial<InjectiveConfig>
  ) {
    this.wallet = PrivateKey.fromMnemonic(mnemonic);

    this.chainConfig = {
      chainId: chainConfig?.chainId ?? "injective-888",
      gasMultiplier: chainConfig?.gasMultiplier ?? 1.2,
      gasPrice: chainConfig?.gasPrice ?? DEFAULT_GAS_PRICE,
    };
  }

  private injectiveAddress(): string {
    return this.wallet.toBech32();
  }

  private async signAndBroadcastMsg(msg: Msgs): Promise<TxResponse> {
    const chainGrpcAuthApi = new ChainGrpcAuthApi(this.grpcEndpoint);
    const account = await chainGrpcAuthApi.fetchAccount(
      this.injectiveAddress()
    );
    const { txRaw: simulateTxRaw } = createTransactionFromMsg({
      sequence: account.baseAccount.sequence,
      accountNumber: account.baseAccount.accountNumber,
      message: msg,
      chainId: this.chainConfig.chainId,
      pubKey: this.wallet.toPublicKey().toBase64(),
    });

    const txService = new TxGrpcClient(this.grpcEndpoint);
    // simulation
    const {
      gasInfo: { gasUsed },
    } = await txService.simulate(simulateTxRaw);

    // simulation returns us the approximate gas used
    // gas passed with the transaction should be more than that
    // in order for it to be successfully executed
    // this multiplier takes care of that
    const fee = {
      amount: [
        {
          denom: "inj",
          amount: (
            gasUsed *
            this.chainConfig.gasPrice *
            this.chainConfig.gasMultiplier
          ).toFixed(),
        },
      ],
      gas: (gasUsed * this.chainConfig.gasMultiplier).toFixed(),
    };

    const { signBytes, txRaw } = createTransactionFromMsg({
      sequence: account.baseAccount.sequence,
      accountNumber: account.baseAccount.accountNumber,
      message: msg,
      chainId: this.chainConfig.chainId,
      fee,
      pubKey: this.wallet.toPublicKey().toBase64(),
    });

    const sig = await this.wallet.sign(Buffer.from(signBytes));

    /** Append Signatures */
    txRaw.setSignaturesList([sig]);

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
