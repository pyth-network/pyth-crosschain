import Web3 from "web3";
import { Contract, EventData } from "web3-eth-contract";
import { WebsocketProvider as WebsocketProviderType } from "web3-providers-ws";
import WebsocketProvider from "web3-providers-ws";
import { AbiItem } from "web3-utils";
import IPythABI from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json";
import { Handler } from "./handler";
import LRUCache from "lru-cache";
import {
  HexString,
  NumberString,
  sleep,
  UnixTimestampString,
  waitForCondition,
} from "./utils";
import {
  BatchPriceFeedInfo,
  BatchPriceFeedUpdateEventValues,
  PriceFeedInfo,
  UpdatePriceFeedsAggregateInfo,
  UpdatePriceFeedsEventValues,
  UpdatePriceFeedsInfo,
} from "./events";

type ListenerConfig = {
  wsEndpoint: string;
  pythContract: string;
};

type BatchHash = string;
function getBatchId(
  chainId: NumberString,
  sequenceNumber: NumberString
): BatchHash {
  return `${chainId}-${sequenceNumber}`;
}

export class Listener {
  private web3: Web3;
  private pythContract: Contract;
  private handler: Handler;
  private blockToTimestamp: LRUCache<number, UnixTimestampString>;
  private batchPrices: LRUCache<BatchHash, PriceFeedInfo[]>;
  private txBatches: LRUCache<HexString, BatchPriceFeedInfo[]>;

  constructor(config: ListenerConfig, handler: Handler) {
    // @ts-ignore The type definition is not correct and complains here. So it is ignored.
    const wsProvider = new WebsocketProvider(config.wsEndpoint, {
      clientConfig: {
        keepalive: true,
        keepaliveInterval: 30000,
      },
      reconnect: {
        auto: true,
        delay: 1000,
        onTimeout: true,
      },
    });
    this.web3 = new Web3(wsProvider);
    this.pythContract = new this.web3.eth.Contract(
      IPythABI as AbiItem[],
      config.pythContract
    );
    this.handler = handler;

    this.blockToTimestamp = new LRUCache({ max: 10000 });
    this.batchPrices = new LRUCache({ max: 10000 });
    this.txBatches = new LRUCache({ max: 10000 });
  }

  async getEffectiveGasPrice(txhash: string): Promise<number | undefined> {
    const txReceipt = await this.web3.eth.getTransactionReceipt(txhash);

    var gasPrice: number;

    // In some networks such as BNB effective gas price is not provided in response.
    // So although typing suggests its a number, it could also be undefined.
    return txReceipt.effectiveGasPrice;
  }

  start() {
    this.web3.eth.subscribe("newBlockHeaders", (_error: Error, blockHeader) => {
      this.blockToTimestamp.set(
        blockHeader.number,
        blockHeader.timestamp.toString()
      );
    });

    this.pythContract.events.PriceFeedUpdate(
      undefined,
      async (_error: Error, event: EventData) => {
        const priceFeedInfo: PriceFeedInfo = {
          id: event.returnValues.id,
          fresh: event.returnValues.fresh,
          chainId: event.returnValues.chainId,
          sequenceNumber: event.returnValues.sequenceNumber,
          lastPublishTime: event.returnValues.lastPublishTime,
          publishTime: event.returnValues.publishTime,
          price: event.returnValues.price,
          conf: event.returnValues.conf,
        };

        const batchHash = getBatchId(
          priceFeedInfo.chainId,
          priceFeedInfo.sequenceNumber
        );
        if (this.batchPrices.has(batchHash) === false) {
          this.batchPrices.set(batchHash, []);
        }
        this.batchPrices.get(batchHash)!.push(priceFeedInfo);
      }
    );

    this.pythContract.events.BatchPriceFeedUpdate(
      undefined,
      async (_error: Error, event: EventData) => {
        const batchValues: BatchPriceFeedUpdateEventValues = {
          chainId: event.returnValues.chainId,
          sequenceNumber: event.returnValues.sequenceNumber,
          batchSize: event.returnValues.batchSize,
          freshPricesInBatch: event.returnValues.freshPricesInBatch,
        };

        const batchHash = getBatchId(
          batchValues.chainId,
          batchValues.sequenceNumber
        );
        if (this.batchPrices.has(batchHash) === false) {
          this.batchPrices.set(batchHash, []);
        }

        const batchSize = Number(batchValues.batchSize);
        const waitForPricesCondition = () =>
          this.batchPrices.has(batchHash) &&
          this.batchPrices.get(batchHash)!.length == batchSize;
        const result = await waitForCondition(waitForPricesCondition, 5000);
        if (result === false) {
          console.error(
            `The price list for ${batchHash} didn't complete. Reason: Timeout`
          );
          return;
        }

        const batchInfo: BatchPriceFeedInfo = {
          priceUpdates: this.batchPrices.get(batchHash)!,
          ...batchValues,
        };

        const txHash = event.transactionHash;
        if (this.txBatches.has(txHash) === false) {
          this.txBatches.set(txHash, []);
        }
        this.txBatches.get(txHash)!.push(batchInfo);
      }
    );

    this.pythContract.events.UpdatePriceFeeds(
      undefined,
      async (_error: Error, event: EventData) => {
        const updateValues: UpdatePriceFeedsEventValues = {
          sender: event.returnValues.sender,
          batchCount: event.returnValues.batchCount,
          fee: event.returnValues.fee,
        };

        const txHash = event.transactionHash;

        if (this.txBatches.has(txHash) === false) {
          this.txBatches.set(txHash, []);
        }

        const batchCount = Number(updateValues.batchCount);
        const waitForBatchesCondition = () =>
          this.txBatches.has(txHash) &&
          this.txBatches.get(txHash)!.length == batchCount;
        const waitForBatchesResult = await waitForCondition(
          waitForBatchesCondition,
          5000
        );
        if (waitForBatchesResult === false) {
          console.error(
            `Couldn't fetch all batches in transaction ${txHash}. Reason: Timeout`
          );
          return;
        }

        const updatePriceFeedsInfo: UpdatePriceFeedsInfo = {
          batchUpdates: this.txBatches.get(txHash)!,
          ...updateValues,
        };

        const waitForTimestampCondition = () =>
          this.blockToTimestamp.has(event.blockNumber);
        const waitForTimestampResult = await waitForCondition(
          waitForTimestampCondition,
          5000
        );
        if (waitForTimestampResult === false) {
          console.error(
            `Couldn't fetch timestamp of transaction ${txHash}. Reason: Timeout`
          );
          return;
        }

        const blockTimestamp = this.blockToTimestamp.get(event.blockNumber)!;

        const tx = await this.web3.eth.getTransaction(txHash);

        const updatePriceFeedsAggregateInfo: UpdatePriceFeedsAggregateInfo = {
          block: event.blockNumber,
          gasPrice: tx.gasPrice,
          effectiveGasPrice: await this.getEffectiveGasPrice(txHash),
          gasUsage: tx.gas,
          rawInput: tx.input,
          timestamp: blockTimestamp,
          txFrom: tx.from,
          txTo: tx.to || undefined,
          txHash: txHash,
          updatePriceFeedsInfo: updatePriceFeedsInfo,
        };

        this.handler.dispatchEvent(updatePriceFeedsAggregateInfo);
      }
    );
  }

  stop() {
    const wsProvider = this.web3.currentProvider as WebsocketProviderType;
    wsProvider.disconnect();
  }
}
