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
import { Account } from "@injectivelabs/sdk-ts/dist/cjs/client/chain/types/auth";

const DEFAULT_GAS_PRICE = 500000000;

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
// TODO: don't poll and only push when a new price is received.
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

      const json = Buffer.from(data).toString();
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
  private account: Account | null = null;

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
    // Fetch the latest account details only if it's not stored in the variable.
    this.account ??= await chainGrpcAuthApi.fetchAccount(
      this.injectiveAddress()
    );

    const { txRaw: simulateTxRaw } = createTransactionFromMsg({
      sequence: this.account.baseAccount.sequence,
      accountNumber: this.account.baseAccount.accountNumber,
      message: msg,
      chainId: this.chainConfig.chainId,
      pubKey: this.wallet.toPublicKey().toBase64(),
    });

    const txService = new TxGrpcClient(this.grpcEndpoint);
    // simulation: approx 0.8secs
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

    try {
      this.account.baseAccount.sequence++;

      /** Append Signatures */
      txRaw.signatures = [sig];
      // this takes approx 5 seconds
      const txResponse = await txService.broadcast(txRaw);

      return txResponse;
    } catch (e: any) {
      // The sequence number was invalid and hence we will have to fetch it again.
      if (e.message.match(/account sequence mismatch/) !== null) {
        // We need to fetch the account details again.
        this.account = null;
      }
      throw e;
    }
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

    // TODO: HOW ABOUT CALCULATING FEE HERE INSTEAD OF IN THE CONTRACT?
    const updateFeeQueryResponse: UpdateFeeResponse = {
      denom: "inj",
      amount: priceFeedUpdateObject.update_price_feeds.data.length.toFixed(),
    };
    // try {
    //   const api = new ChainGrpcWasmApi(this.grpcEndpoint);
    //   const { data } = await api.fetchSmartContractState(
    //     this.pythContractAddress,
    //     Buffer.from(
    //       JSON.stringify({
    //         get_update_fee: {
    //           vaas: priceFeedUpdateObject.update_price_feeds.data,
    //         },
    //       })
    //     ).toString("base64")
    //   );

    //   const json = Buffer.from(data).toString();
    //   updateFeeQueryResponse = JSON.parse(json);
    // } catch (e) {
    //   console.error("Error fetching update fee");
    //   console.error(e);
    //   return;
    // }

    try {
      const executeMsg = MsgExecuteContract.fromJSON({
        sender: this.injectiveAddress(),
        contractAddress: this.pythContractAddress,
        msg: priceFeedUpdateObject,
        funds: [updateFeeQueryResponse],
      });

      const rs = await this.signAndBroadcastMsg(executeMsg);
      console.log("Succesfully broadcasted txHash:", rs.txHash);
    } catch (e: any) {
      if (e.message.match(/account inj[a-zA-Z0-9]+ not found/) !== null) {
        console.error(e);
        throw new Error("Please check the mnemonic");
      }

      if (
        e.message.match(/insufficient/) !== null &&
        e.message.match(/funds/) !== null
      ) {
        console.error(e);
        throw new Error("Insufficient funds");
      }
      console.error("Error executing messages");
      console.log(e);
    }
  }
}
