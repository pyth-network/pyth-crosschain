import { Contract, EventData } from "web3-eth-contract";
import {
  IPricePusher,
  PriceInfo,
  ChainPriceListener,
  PriceItem,
} from "../interface";
import { TransactionReceipt } from "ethereum-protocol";
import { addLeading0x, DurationInSeconds, removeLeading0x } from "../utils";
import AbstractPythAbi from "@pythnetwork/pyth-sdk-solidity/abis/AbstractPyth.json";
import HDWalletProvider from "@truffle/hdwallet-provider";
import Web3 from "web3";
import { isWsEndpoint } from "../utils";
import {
  PriceServiceConnection,
  HexString,
  UnixTimestamp,
} from "@pythnetwork/price-service-client";
import { CustomGasStation } from "./custom-gas-station";
import { Provider } from "web3/providers";
import { PushAttempt } from "../common";

export class EvmPriceListener extends ChainPriceListener {
  private pythContractFactory: PythContractFactory;
  private pythContract: Contract;

  constructor(
    pythContractFactory: PythContractFactory,
    priceItems: PriceItem[],
    config: {
      pollingFrequency: DurationInSeconds;
    }
  ) {
    super("Evm", config.pollingFrequency, priceItems);

    this.pythContractFactory = pythContractFactory;
    this.pythContract = this.pythContractFactory.createPythContract();
  }

  // This method should be awaited on and once it finishes it has the latest value
  // for the given price feeds (if they exist).
  async start() {
    if (this.pythContractFactory.hasWebsocketProvider()) {
      console.log("Subscribing to the target network pyth contract events...");
      this.startSubscription();
    } else {
      console.log(
        "The target network RPC endpoint is not Websocket. " +
          "Listening for updates only via polling...."
      );
    }

    // base class for polling
    await super.start();
  }

  private async startSubscription() {
    for (const { id: priceId } of this.priceItems) {
      this.pythContract.events.PriceFeedUpdate(
        {
          filter: {
            id: addLeading0x(priceId),
            fresh: true,
          },
        },
        this.onPriceFeedUpdate.bind(this)
      );
    }
  }

  private onPriceFeedUpdate(err: Error | null, event: EventData) {
    if (err !== null) {
      console.error("PriceFeedUpdate EventEmitter received an error..");
      throw err;
    }

    const priceId = removeLeading0x(event.returnValues.id);
    console.log(
      `Received a new Evm PriceFeedUpdate event for price feed ${this.priceIdToAlias.get(
        priceId
      )} (${priceId}).`
    );

    const priceInfo: PriceInfo = {
      conf: event.returnValues.conf,
      price: event.returnValues.price,
      publishTime: Number(event.returnValues.publishTime),
    };

    this.updateLatestPriceInfo(priceId, priceInfo);
  }

  async getOnChainPriceInfo(
    priceId: HexString
  ): Promise<PriceInfo | undefined> {
    let priceRaw;
    try {
      priceRaw = await this.pythContract.methods
        .getPriceUnsafe(addLeading0x(priceId))
        .call();
    } catch (e) {
      console.error(`Polling on-chain price for ${priceId} failed. Error:`);
      console.error(e);
      return undefined;
    }

    console.log(
      `Polled an EVM on chain price for feed ${this.priceIdToAlias.get(
        priceId
      )} (${priceId}).`
    );

    return {
      conf: priceRaw.conf,
      price: priceRaw.price,
      publishTime: Number(priceRaw.publishTime),
    };
  }
}

export class EvmPricePusher implements IPricePusher {
  private customGasStation?: CustomGasStation;
  private pythContract: Contract;
  private web3: Web3;
  private pusherAddress: string | undefined;
  private lastPushAttempt: PushAttempt | undefined;

  constructor(
    private connection: PriceServiceConnection,
    pythContractFactory: PythContractFactory,
    private overrideGasPriceMultiplier: number,
    private overrideGasPriceMultiplierCap: number,
    private updateFeeMultiplier: number,
    private gasLimit?: number,
    customGasStation?: CustomGasStation
  ) {
    this.customGasStation = customGasStation;
    this.pythContract = pythContractFactory.createPythContractWithPayer();
    this.web3 = new Web3(pythContractFactory.createWeb3PayerProvider() as any);
  }

  // The pubTimes are passed here to use the values that triggered the push.
  // This is an optimization to avoid getting a newer value (as an update comes)
  // and will help multiple price pushers to have consistent behaviour.
  // To ensure that we transactions are landing and we are not pushing the prices twice
  // we will re-use the same nonce (with a higher gas price) if the previous transaction
  // is not landed yet.
  async updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: UnixTimestamp[]
  ): Promise<void> {
    if (priceIds.length === 0) {
      return;
    }

    if (priceIds.length !== pubTimesToPush.length)
      throw new Error("Invalid arguments");

    const priceIdsWith0x = priceIds.map((priceId) => addLeading0x(priceId));

    const priceFeedUpdateData = await this.getPriceFeedsUpdateData(
      priceIdsWith0x
    );

    console.log("Pushing ", priceIdsWith0x);

    let updateFee;

    try {
      updateFee = await this.pythContract.methods
        .getUpdateFee(priceFeedUpdateData)
        .call();
      updateFee = Number(updateFee) * (this.updateFeeMultiplier || 1);
      console.log(`Update fee: ${updateFee}`);
    } catch (e: any) {
      console.error(
        "An unidentified error has occured when getting the update fee:"
      );
      throw e;
    }

    let gasPrice = Number(
      (await this.customGasStation?.getCustomGasPrice()) ||
        (await this.web3.eth.getGasPrice())
    );

    // Try to re-use the same nonce and increase the gas if the last tx is not landed yet.
    if (this.pusherAddress === undefined) {
      this.pusherAddress = (await this.web3.eth.getAccounts())[0];
    }
    const lastExecutedNonce =
      (await this.web3.eth.getTransactionCount(this.pusherAddress)) - 1;

    let gasPriceToOverride = undefined;

    if (this.lastPushAttempt !== undefined) {
      if (this.lastPushAttempt.nonce <= lastExecutedNonce) {
        this.lastPushAttempt = undefined;
      } else {
        gasPriceToOverride = Math.ceil(
          this.lastPushAttempt.gasPrice * this.overrideGasPriceMultiplier
        );
      }
    }

    if (gasPriceToOverride !== undefined && gasPriceToOverride > gasPrice) {
      gasPrice = Math.min(
        gasPriceToOverride,
        gasPrice * this.overrideGasPriceMultiplierCap
      );
    }

    const txNonce = lastExecutedNonce + 1;

    console.log(`Using gas price: ${gasPrice} and nonce: ${txNonce}`);

    this.pythContract.methods
      .updatePriceFeedsIfNecessary(
        priceFeedUpdateData,
        priceIdsWith0x,
        pubTimesToPush
      )
      .send({
        value: updateFee,
        gasPrice,
        nonce: txNonce,
        gasLimit: this.gasLimit,
      })
      .on("transactionHash", (hash: string) => {
        console.log(`Successful. Tx hash: ${hash}`);
      })
      .on("error", (err: Error, receipt?: TransactionReceipt) => {
        if (err.message.includes("revert")) {
          // Since we are using custom error structs on solidity the rejection
          // doesn't return any information why the call has reverted. Assuming that
          // the update data is valid there is no possible rejection cause other than
          // the target chain price being already updated.
          console.log(
            "Execution reverted. With high probability, the target chain price " +
              "has already updated, Skipping this push."
          );
          return;
        }

        if (
          err.message.includes("the tx doesn't have the correct nonce.") ||
          err.message.includes("nonce too low") ||
          err.message.includes("invalid nonce")
        ) {
          console.log(
            "The nonce is incorrect (are multiple users using this account?). Skipping this push."
          );
          return;
        }

        if (err.message.includes("max fee per gas less than block base fee")) {
          // We just have to handle this error and return.
          // LastPushAttempt was stored with the class
          // Next time the update will be executing, it will check the last attempt
          // and increase the gas price accordingly.
          console.log(
            "The transaction failed with error: max fee per gas less than block base fee "
          );
          return;
        }

        if (
          err.message.includes("sender doesn't have enough funds to send tx.")
        ) {
          console.error("Payer is out of balance, please top it up.");
          throw err;
        }

        if (err.message.includes("transaction underpriced")) {
          console.error(
            "The gas price of the transaction is too low. Skipping this push. " +
              "You might want to use a custom gas station or increase the override gas price " +
              "multiplier to increase the likelihood of the transaction landing on-chain."
          );
          return;
        }

        if (err.message.includes("could not replace existing tx")) {
          console.log(
            "A transaction with the same nonce has been mined and this one is no longer needed."
          );
          return;
        }

        console.error("An unidentified error has occured:");
        console.error(receipt);
        throw err;
      });

    // Update lastAttempt
    this.lastPushAttempt = {
      nonce: txNonce,
      gasPrice: gasPrice,
    };
  }

  private async getPriceFeedsUpdateData(
    priceIds: HexString[]
  ): Promise<string[]> {
    const latestVaas = await this.connection.getLatestVaas(priceIds);
    return latestVaas.map(
      (vaa) => "0x" + Buffer.from(vaa, "base64").toString("hex")
    );
  }
}

export class PythContractFactory {
  constructor(
    private endpoint: string,
    private mnemonic: string,
    private pythContractAddress: string
  ) {}

  /**
   * This method creates a web3 Pyth contract with payer (based on HDWalletProvider). As this
   * provider is an HDWalletProvider it does not support subscriptions even if the
   * endpoint is a websocket endpoint.
   *
   * @returns Pyth contract
   */
  createPythContractWithPayer(): Contract {
    const provider = this.createWeb3PayerProvider();

    const web3 = new Web3(provider as any);

    return new web3.eth.Contract(
      AbstractPythAbi as any,
      this.pythContractAddress,
      {
        from: provider.getAddress(0),
      }
    );
  }

  /**
   * This method creates a web3 Pyth contract with the given endpoint as its provider. If
   * the endpoint is a websocket endpoint the contract will support subscriptions.
   *
   * @returns Pyth contract
   */
  createPythContract(): Contract {
    const provider = this.createWeb3Provider();
    const web3 = new Web3(provider);
    return new web3.eth.Contract(
      AbstractPythAbi as any,
      this.pythContractAddress
    );
  }

  hasWebsocketProvider(): boolean {
    return isWsEndpoint(this.endpoint);
  }

  createWeb3Provider() {
    if (isWsEndpoint(this.endpoint)) {
      Web3.providers.WebsocketProvider.prototype.sendAsync =
        Web3.providers.WebsocketProvider.prototype.send;
      return new Web3.providers.WebsocketProvider(this.endpoint, {
        clientConfig: {
          keepalive: true,
          keepaliveInterval: 30000,
        },
        reconnect: {
          auto: true,
          delay: 1000,
          onTimeout: true,
        },
        timeout: 30000,
      });
    } else {
      Web3.providers.HttpProvider.prototype.sendAsync =
        Web3.providers.HttpProvider.prototype.send;
      return new Web3.providers.HttpProvider(this.endpoint, {
        keepAlive: true,
        timeout: 30000,
      });
    }
  }

  createWeb3PayerProvider() {
    return new HDWalletProvider({
      mnemonic: {
        phrase: this.mnemonic,
      },
      providerOrUrl: this.createWeb3Provider() as Provider,
    });
  }
}
