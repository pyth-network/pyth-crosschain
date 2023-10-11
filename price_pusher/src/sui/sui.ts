import {
  ChainPriceListener,
  IPricePusher,
  PriceInfo,
  PriceItem,
} from "../interface";
import { DurationInSeconds } from "../utils";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import {
  JsonRpcProvider,
  Connection,
  Ed25519Keypair,
  RawSigner,
  TransactionBlock,
  getCreatedObjects,
  SuiObjectRef,
  getTransactionEffects,
  getExecutionStatusError,
  PaginatedCoins,
  SuiAddress,
  ObjectId,
} from "@mysten/sui.js";
import { SuiPythClient } from "@pythnetwork/pyth-sui-js";

const GAS_FEE_FOR_SPLIT = 2_000_000_000;
// TODO: read this from on chain config
const MAX_NUM_GAS_OBJECTS_IN_PTB = 256;
const MAX_NUM_OBJECTS_IN_ARGUMENT = 510;

export class SuiPriceListener extends ChainPriceListener {
  private pythClient: SuiPythClient;
  private provider: JsonRpcProvider;

  constructor(
    pythStateId: ObjectId,
    wormholeStateId: ObjectId,
    endpoint: string,
    priceItems: PriceItem[],
    config: {
      pollingFrequency: DurationInSeconds;
    }
  ) {
    super("sui", config.pollingFrequency, priceItems);
    this.provider = new JsonRpcProvider(new Connection({ fullnode: endpoint }));
    this.pythClient = new SuiPythClient(
      this.provider,
      pythStateId,
      wormholeStateId
    );
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const priceInfoObjectId = await this.pythClient.getPriceFeedObjectId(
        priceId
      );
      if (priceInfoObjectId === undefined) {
        throw new Error("Price not found on chain for price id " + priceId);
      }

      // Fetching the price info object for the above priceInfoObjectId
      const priceInfoObject = await this.provider.getObject({
        id: priceInfoObjectId,
        options: { showContent: true },
      });

      if (
        priceInfoObject.data === undefined ||
        priceInfoObject.data.content === undefined
      )
        throw new Error("Price not found on chain for price id " + priceId);

      if (priceInfoObject.data.content.dataType !== "moveObject")
        throw new Error("fetched object datatype should be moveObject");

      const { magnitude, negative } =
        priceInfoObject.data.content.fields.price_info.fields.price_feed.fields
          .price.fields.price.fields;

      const conf =
        priceInfoObject.data.content.fields.price_info.fields.price_feed.fields
          .price.fields.conf;

      const timestamp =
        priceInfoObject.data.content.fields.price_info.fields.price_feed.fields
          .price.fields.timestamp;

      return {
        price: negative ? "-" + magnitude : magnitude,
        conf,
        publishTime: Number(timestamp),
      };
    } catch (e) {
      console.error(`Polling Sui on-chain price for ${priceId} failed. Error:`);
      console.error(e);
      return undefined;
    }
  }
}

/**
 * The `SuiPricePusher` is designed for high-throughput of price updates.
 * Achieving this property requires sacrificing some nice-to-have features of other
 * pusher implementations that can reduce cost when running multiple pushers. It also requires
 * jumping through some Sui-specific hoops in order to maximize parallelism.
 *
 * The two main design features are:
 * 1. This implementation does not use `update_price_feeds_if_necssary` and simulate the transaction
 *    before submission. If multiple instances of this pusher are running in parallel, all of them will
 *    land all of their pushed updates on-chain.
 * 2. The pusher will split the Coin balance in the provided account into a pool of different Coin objects.
 *    Each transaction will be allocated a Coin object from this pool as needed. This process enables the
 *    transactions to avoid referencing the same owned objects, which allows them to be processed in parallel.
 */
export class SuiPricePusher implements IPricePusher {
  constructor(
    private readonly signer: RawSigner,
    private priceServiceConnection: PriceServiceConnection,
    private pythPackageId: string,
    private pythStateId: string,
    private wormholePackageId: string,
    private wormholeStateId: string,
    endpoint: string,
    mnemonic: string,
    private gasBudget: number,
    private gasPool: SuiObjectRef[],
    private pythClient: SuiPythClient
  ) {}

  /**
   * getPackageId returns the latest package id that the object belongs to. Use this to
   * fetch the latest package id for a given object id and handle package upgrades automatically.
   * @param provider
   * @param objectId
   * @returns package id
   */
  static async getPackageId(
    provider: JsonRpcProvider,
    objectId: ObjectId
  ): Promise<ObjectId> {
    const state = await provider
      .getObject({
        id: objectId,
        options: {
          showContent: true,
        },
      })
      .then((result) => {
        if (result.data?.content?.dataType == "moveObject") {
          return result.data.content.fields;
        }

        throw new Error("not move object");
      });

    if ("upgrade_cap" in state) {
      return state.upgrade_cap.fields.package;
    }

    throw new Error("upgrade_cap not found");
  }

  /**
   * Create a price pusher with a pool of `numGasObjects` gas coins that will be used to send transactions.
   * The gas coins of the wallet for the provided mnemonic will be merged and then evenly split into `numGasObjects`.
   */
  static async createWithAutomaticGasPool(
    priceServiceConnection: PriceServiceConnection,
    pythStateId: string,
    wormholeStateId: string,
    endpoint: string,
    mnemonic: string,
    gasBudget: number,
    numGasObjects: number
  ): Promise<SuiPricePusher> {
    if (numGasObjects > MAX_NUM_OBJECTS_IN_ARGUMENT) {
      throw new Error(
        `numGasObjects cannot be greater than ${MAX_NUM_OBJECTS_IN_ARGUMENT} until we implement split chunking`
      );
    }

    const provider = new JsonRpcProvider(
      new Connection({ fullnode: endpoint })
    );
    const signer = new RawSigner(
      Ed25519Keypair.deriveKeypair(mnemonic),
      provider
    );
    const pythPackageId = await SuiPricePusher.getPackageId(
      provider,
      pythStateId
    );
    const wormholePackageId = await SuiPricePusher.getPackageId(
      provider,
      wormholeStateId
    );

    const gasPool = await SuiPricePusher.initializeGasPool(
      signer,
      numGasObjects
    );

    const pythClient = new SuiPythClient(
      provider,
      pythStateId,
      wormholeStateId
    );

    return new SuiPricePusher(
      signer,
      priceServiceConnection,
      pythPackageId,
      pythStateId,
      wormholePackageId,
      wormholeStateId,
      endpoint,
      mnemonic,
      gasBudget,
      gasPool,
      pythClient
    );
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

    if (this.gasPool.length === 0) {
      console.warn("Skipping update: no available gas coin.");
      return;
    }

    // 3 price feeds per transaction is the optimal number for gas cost.
    const priceIdChunks = chunkArray(priceIds, 3);

    const txBlocks: TransactionBlock[] = [];

    await Promise.all(
      priceIdChunks.map(async (priceIdChunk) => {
        const vaas = await this.priceServiceConnection.getLatestVaas(
          priceIdChunk
        );
        if (vaas.length !== 1) {
          throw new Error(
            `Expected a single VAA for all priceIds ${priceIdChunk} but received ${vaas.length} VAAs: ${vaas}`
          );
        }
        const vaa = vaas[0];
        const tx = new TransactionBlock();
        await this.pythClient.updatePriceFeeds(
          tx,
          [Buffer.from(vaa, "base64")],
          priceIdChunk
        );
        txBlocks.push(tx);
      })
    );

    await this.sendTransactionBlocks(txBlocks);
  }

  /** Send every transaction in txs in parallel, returning when all transactions have completed. */
  private async sendTransactionBlocks(
    txs: TransactionBlock[]
  ): Promise<void[]> {
    return Promise.all(txs.map((tx) => this.sendTransactionBlock(tx)));
  }

  /** Send a single transaction block using a gas coin from the pool. */
  private async sendTransactionBlock(tx: TransactionBlock): Promise<void> {
    const gasObject = this.gasPool.shift();
    if (gasObject === undefined) {
      console.warn("No available gas coin. Skipping push.");
      return;
    }

    let nextGasObject: SuiObjectRef | undefined = undefined;
    try {
      tx.setGasPayment([gasObject]);
      tx.setGasBudget(this.gasBudget);
      const result = await this.signer.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: {
          showEffects: true,
        },
      });

      nextGasObject = getTransactionEffects(result)
        ?.mutated?.map((obj) => obj.reference)
        .find((ref) => ref.objectId === gasObject.objectId);

      console.log(
        "Successfully updated price with transaction digest ",
        result.digest
      );
    } catch (e: any) {
      console.log("Error when signAndExecuteTransactionBlock");
      if (String(e).includes("GasBalanceTooLow")) {
        console.warn(
          `The balance of gas object ${gasObject.objectId} is too low. Removing from pool.`
        );
      } else {
        // Refresh the coin object here in case the error is caused by an object version mismatch.
        nextGasObject = await SuiPricePusher.tryRefreshObjectReference(
          this.signer.provider,
          gasObject
        );
      }
      console.error(e);

      if ("data" in e) {
        console.error("Error has .data field:");
        console.error(JSON.stringify(e.data));
      }
    }

    if (nextGasObject !== undefined) {
      this.gasPool.push(nextGasObject);
    }
  }

  // This function will smash all coins owned by the signer into one, and then
  // split them equally into numGasObjects.
  private static async initializeGasPool(
    signer: RawSigner,
    numGasObjects: number
  ): Promise<SuiObjectRef[]> {
    const signerAddress = await signer.getAddress();

    const consolidatedCoin = await SuiPricePusher.mergeGasCoinsIntoOne(
      signer,
      signerAddress
    );
    const coinResult = await signer.provider.getObject({
      id: consolidatedCoin.objectId,
      options: { showContent: true },
    });
    let balance;
    if (
      coinResult.data &&
      coinResult.data.content &&
      coinResult.data.content.dataType == "moveObject"
    ) {
      balance = coinResult.data.content.fields.balance;
    } else throw new Error("Bad coin object");
    const splitAmount =
      (BigInt(balance) - BigInt(GAS_FEE_FOR_SPLIT)) / BigInt(numGasObjects);

    const gasPool = await SuiPricePusher.splitGasCoinEqually(
      signer,
      signerAddress,
      Number(splitAmount),
      numGasObjects,
      consolidatedCoin
    );
    console.log("Gas pool is filled with coins: ", gasPool);
    return gasPool;
  }

  // Attempt to refresh the version of the provided object reference to point to the current version
  // of the object. Return the provided object reference if an error occurs or the object could not
  // be retrieved.
  private static async tryRefreshObjectReference(
    provider: JsonRpcProvider,
    ref: SuiObjectRef
  ): Promise<SuiObjectRef> {
    try {
      const objectResponse = await provider.getObject({ id: ref.objectId });
      if (objectResponse.data !== undefined) {
        return {
          digest: objectResponse.data.digest,
          objectId: objectResponse.data.objectId,
          version: objectResponse.data.version,
        };
      } else {
        return ref;
      }
    } catch (error) {
      return ref;
    }
  }

  private static async getAllGasCoins(
    provider: JsonRpcProvider,
    owner: SuiAddress
  ): Promise<SuiObjectRef[]> {
    let hasNextPage = true;
    let cursor;
    const coins = new Set<string>([]);
    let numCoins = 0;
    while (hasNextPage) {
      const paginatedCoins: PaginatedCoins = await provider.getCoins({
        owner,
        cursor,
      });
      numCoins += paginatedCoins.data.length;
      paginatedCoins.data.forEach((c) =>
        coins.add(
          JSON.stringify({
            objectId: c.coinObjectId,
            version: c.version,
            digest: c.digest,
          })
        )
      );
      hasNextPage = paginatedCoins.hasNextPage;
      cursor = paginatedCoins.nextCursor;
    }

    if (numCoins !== coins.size) {
      throw new Error("Unexpected getCoins result: duplicate coins found");
    }
    return [...coins].map((item) => JSON.parse(item));
  }

  private static async splitGasCoinEqually(
    signer: RawSigner,
    signerAddress: SuiAddress,
    splitAmount: number,
    numGasObjects: number,
    gasCoin: SuiObjectRef
  ): Promise<SuiObjectRef[]> {
    // TODO: implement chunking if numGasObjects exceeds MAX_NUM_CREATED_OBJECTS
    const tx = new TransactionBlock();
    const coins = tx.splitCoins(
      tx.gas,
      Array.from({ length: numGasObjects }, () => tx.pure(splitAmount))
    );

    tx.transferObjects(
      Array.from({ length: numGasObjects }, (_, i) => coins[i]),
      tx.pure(signerAddress)
    );
    tx.setGasPayment([gasCoin]);
    const result = await signer.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      options: { showEffects: true },
    });
    const error = getExecutionStatusError(result);
    if (error) {
      throw new Error(
        `Failed to initialize gas pool: ${error}. Try re-running the script`
      );
    }
    const newCoins = getCreatedObjects(result)!.map((obj) => obj.reference);
    if (newCoins.length !== numGasObjects) {
      throw new Error(
        `Failed to initialize gas pool. Expected ${numGasObjects}, got: ${newCoins}`
      );
    }
    return newCoins;
  }

  private static async mergeGasCoinsIntoOne(
    signer: RawSigner,
    owner: SuiAddress
  ): Promise<SuiObjectRef> {
    const gasCoins = await SuiPricePusher.getAllGasCoins(
      signer.provider,
      owner
    );
    // skip merging if there is only one coin
    if (gasCoins.length === 1) {
      return gasCoins[0];
    }

    const gasCoinsChunks = chunkArray<SuiObjectRef>(
      gasCoins,
      MAX_NUM_GAS_OBJECTS_IN_PTB - 2
    );
    let finalCoin;
    const lockedAddresses: Set<string> = new Set();
    for (let i = 0; i < gasCoinsChunks.length; i++) {
      const mergeTx = new TransactionBlock();
      let coins = gasCoinsChunks[i];
      coins = coins.filter((coin) => !lockedAddresses.has(coin.objectId));
      if (finalCoin) {
        coins = [finalCoin, ...coins];
      }
      mergeTx.setGasPayment(coins);
      let mergeResult;
      try {
        mergeResult = await signer.signAndExecuteTransactionBlock({
          transactionBlock: mergeTx,
          options: { showEffects: true },
        });
      } catch (e) {
        if (
          String(e).includes(
            "quorum of validators because of locked objects. Retried a conflicting transaction"
          )
        ) {
          Object.values((e as any).data).forEach((lockedObjects: any) => {
            lockedObjects.forEach((lockedObject: [string, number, string]) => {
              lockedAddresses.add(lockedObject[0]);
            });
          });
          // retry merging without the locked coins
          i--;
          continue;
        }
        throw e;
      }
      const error = getExecutionStatusError(mergeResult);
      if (error) {
        throw new Error(
          `Failed to merge coins when initializing gas pool: ${error}. Try re-running the script`
        );
      }
      finalCoin = getTransactionEffects(mergeResult)!.mutated!.map(
        (obj) => obj.reference
      )[0];
    }

    return finalCoin as SuiObjectRef;
  }
}

function chunkArray<T>(array: Array<T>, size: number): Array<Array<T>> {
  const chunked = [];
  let index = 0;
  while (index < array.length) {
    chunked.push(array.slice(index, size + index));
    index += size;
  }
  return chunked;
}
