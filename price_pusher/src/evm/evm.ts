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
import { Provider } from "web3/providers";
import Web3 from "web3";
import { isWsEndpoint } from "../utils";
import {
  PriceServiceConnection,
  HexString,
  UnixTimestamp,
} from "@pythnetwork/price-service-client";
import { CustomGasStation } from "./custom-gas-station";

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
  constructor(
    private connection: PriceServiceConnection,
    private pythContract: Contract,
    customGasStation?: CustomGasStation
  ) {
    this.customGasStation = customGasStation;
  }
  // The pubTimes are passed here to use the values that triggered the push.
  // This is an optimization to avoid getting a newer value (as an update comes)
  // and will help multiple price pushers to have consistent behaviour.
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

    console.log(
      "Pushing ",
      priceIdsWith0x.map((priceIdWith0x) => `${priceIdWith0x}`)
    );
    const updateFee = await this.pythContract.methods
      .getUpdateFee(priceFeedUpdateData)
      .call();
    console.log(`Update fee: ${updateFee}`);

    const gasPrice = await this.customGasStation?.getCustomGasPrice();

    this.pythContract.methods
      .updatePriceFeedsIfNecessary(
        priceFeedUpdateData,
        priceIdsWith0x,
        pubTimesToPush
      )
      .send({ value: updateFee, gasPrice })
      .on("transactionHash", (hash: string) => {
        console.log(`Successful. Tx hash: ${hash}`);
      })
      .on("error", (err: Error, receipt?: TransactionReceipt) => {
        if (
          err.message.includes(
            "VM Exception while processing transaction: revert"
          )
        ) {
          // Since we are using custom error structs on solidity the rejection
          // doesn't return any information why the call has reverted. Assuming that
          // the update data is valid there is no possible rejection cause other than
          // the target chain price being already updated.
          console.log(
            "Execution reverted. With high probablity, the target chain price " +
              "has already updated, Skipping this push."
          );
          return;
        }

        if (
          err.message.includes("the tx doesn't have the correct nonce.") ||
          err.message.includes("nonce too low")
        ) {
          console.log(
            "Multiple users are using the same accounts and nonce is incorrect. Skipping this push."
          );
          return;
        }

        if (
          err.message.includes("sender doesn't have enough funds to send tx.")
        ) {
          console.error("Payer is out of balance, please top it up.");
          throw err;
        }

        console.error("An unidentified error has occured:");
        console.error(receipt);
        throw err;
      });
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
    const provider = new HDWalletProvider({
      mnemonic: {
        phrase: this.mnemonic,
      },
      providerOrUrl: this.createWeb3Provider() as Provider,
    });

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

  private createWeb3Provider() {
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
}
