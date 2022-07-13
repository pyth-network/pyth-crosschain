import Web3 from "web3";
import { Contract, EventData } from "web3-eth-contract";
import { WebsocketProvider as WebsocketProviderType } from "web3-providers-ws";
import WebsocketProvider from "web3-providers-ws";
import { AbiItem } from "web3-utils";
import IPythABI from "./abi.json"
import { Handler } from "./handler";

type ListenerConfig = {
  wsEndpoint: string,
  pythContract: string
};

export class Listener {
  private web3: Web3;
  private pythContract: Contract;
  private handler: Handler;

  constructor(config: ListenerConfig, handler: Handler) {
    // @ts-ignore The type definition is not correct and complains here. So it is ignored.
    const wsProvider = new WebsocketProvider(config.wsEndpoint, {
      clientConfig: {
        keepalive: true,
        keepaliveInterval: 30000  
      },
      reconnect: {
        auto: true,
        delay: 1000,
        onTimeout: true,
      }
    });
    this.web3 = new Web3(wsProvider);
    this.pythContract = new this.web3.eth.Contract(IPythABI as AbiItem[], config.pythContract);
    this.handler = handler;
  }

  async getTxFee(txhash: string): Promise<number> {
    const txReceipt = await this.web3.eth.getTransactionReceipt(txhash);

    var gasPrice: number;

    // In some networks such as BNB effective gas price is not provided in response.
    if (txReceipt.effectiveGasPrice !== undefined) {
      gasPrice = txReceipt.effectiveGasPrice;
    } else {
      const tx = await this.web3.eth.getTransaction(txhash);
      gasPrice = Number(tx.gasPrice);
    }

    return gasPrice * txReceipt.gasUsed / 1000000000 / 1000000000;
  }

  start() {
    this.web3.eth.subscribe('newBlockHeaders', (_error: Error, blockHeader) => {
      console.dir(blockHeader);
    });
    const pythEmitter = this.pythContract.events.PriceUpdate(undefined, async (_error: Error, event: EventData) => {
      console.dir(event);
    });
  }

  stop() {
    const wsProvider = this.web3.currentProvider as WebsocketProviderType;
    wsProvider.disconnect();
  }
}
