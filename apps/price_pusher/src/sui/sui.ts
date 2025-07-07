import {
  ChainPriceListener,
  IPricePusher,
  PriceInfo,
  PriceItem,
} from "../interface";
import { DurationInSeconds } from "../utils";
import { SuiPythClient } from "@pythnetwork/pyth-sui-js";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient, SuiObjectRef, PaginatedCoins } from "@mysten/sui/client";
import { Logger } from "pino";
import { HermesClient } from "@pythnetwork/hermes-client";
const GAS_FEE_FOR_SPLIT = 2_000_000_000;
// TODO: read this from on chain config
const MAX_NUM_GAS_OBJECTS_IN_PTB = 256;
const MAX_NUM_OBJECTS_IN_ARGUMENT = 510;

type ObjectId = string;
type SuiAddress = string;

export class SuiPriceListener extends ChainPriceListener {
  private pythClient: SuiPythClient;
  private provider: SuiClient;
  private logger: Logger;

  constructor(
    pythStateId: ObjectId,
    wormholeStateId: ObjectId,
    endpoint: string,
    priceItems: PriceItem[],
    logger: Logger,
    config: {
      pollingFrequency: DurationInSeconds;
    },
  ) {
    super(config.pollingFrequency, priceItems);
    this.provider = new SuiClient({ url: endpoint });
    this.pythClient = new SuiPythClient(
      this.provider,
      pythStateId,
      wormholeStateId,
    );
    this.logger = logger;
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const priceInfoObjectId =
        await this.pythClient.getPriceFeedObjectId(priceId);
      if (priceInfoObjectId === undefined) {
        throw new Error("Price not found on chain for price id " + priceId);
      }

      // Fetching the price info object for the above priceInfoObjectId
      const priceInfoObject = await this.provider.getObject({
        id: priceInfoObjectId,
        options: { showContent: true },
      });

      if (!priceInfoObject.data || !priceInfoObject.data.content)
        throw new Error("Price not found on chain for price id " + priceId);

      if (priceInfoObject.data.content.dataType !== "moveObject")
        throw new Error("fetched object datatype should be moveObject");

      const priceInfo =
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        priceInfoObject.data.content.fields.price_info.fields.price_feed.fields
          .price.fields;
      const { magnitude, negative } = priceInfo.price.fields;

      const conf = priceInfo.conf;

      const timestamp = priceInfo.timestamp;

      return {
        price: negative ? "-" + magnitude : magnitude,
        conf,
        publishTime: Number(timestamp),
      };
    } catch (err) {
      this.logger.error(
        err,
        `Polling Sui on-chain price for ${priceId} failed.`,
      );
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
    private readonly signer: Ed25519Keypair,
    private readonly provider: SuiClient,
    private logger: Logger,
    private hermesClient: HermesClient,
    private gasBudget: number,
    private gasPool: SuiObjectRef[],
    private pythClient: SuiPythClient,
  ) {}

  /**
   * getPackageId returns the latest package id that the object belongs to. Use this to
   * fetch the latest package id for a given object id and handle package upgrades automatically.
   * @param provider
   * @param objectId
   * @returns package id
   */
  static async getPackageId(
    provider: SuiClient,
    objectId: ObjectId,
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
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return state.upgrade_cap.fields.package;
    }

    throw new Error("upgrade_cap not found");
  }

  /**
   * Create a price pusher with a pool of `numGasObjects` gas coins that will be used to send transactions.
   * The gas coins of the wallet for the provided keypair will be merged and then evenly split into `numGasObjects`.
   */
  static async createWithAutomaticGasPool(
    hermesClient: HermesClient,
    logger: Logger,
    pythStateId: string,
    wormholeStateId: string,
    endpoint: string,
    keypair: Ed25519Keypair,
    gasBudget: number,
    numGasObjects: number,
    ignoreGasObjects: string[],
  ): Promise<SuiPricePusher> {
    if (numGasObjects > MAX_NUM_OBJECTS_IN_ARGUMENT) {
      throw new Error(
        `numGasObjects cannot be greater than ${MAX_NUM_OBJECTS_IN_ARGUMENT} until we implement split chunking`,
      );
    }

    const provider = new SuiClient({ url: endpoint });

    const gasPool = await SuiPricePusher.initializeGasPool(
      keypair,
      provider,
      numGasObjects,
      ignoreGasObjects,
      logger,
    );

    const pythClient = new SuiPythClient(
      provider,
      pythStateId,
      wormholeStateId,
    );

    return new SuiPricePusher(
      keypair,
      provider,
      logger,
      hermesClient,
      gasBudget,
      gasPool,
      pythClient,
    );
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

    if (this.gasPool.length === 0) {
      this.logger.warn("Skipping update: no available gas coin.");
      return;
    }

    // 3 price feeds per transaction is the optimal number for gas cost.
    const priceIdChunks = chunkArray(priceIds, 3);

    const txBlocks: Transaction[] = [];

    await Promise.all(
      priceIdChunks.map(async (priceIdChunk) => {
        const response = await this.hermesClient.getLatestPriceUpdates(
          priceIdChunk,
          {
            encoding: "base64",
            ignoreInvalidPriceIds: true,
          },
        );
        if (response.binary.data.length !== 1) {
          throw new Error(
            `Expected a single VAA for all priceIds ${priceIdChunk} but received ${response.binary.data.length} VAAs: ${response.binary.data}`,
          );
        }
        const vaa = response.binary.data[0];
        const tx = new Transaction();
        await this.pythClient.updatePriceFeeds(
          tx,
          [Buffer.from(vaa, "base64")],
          priceIdChunk,
        );
        txBlocks.push(tx);
      }),
    );

    await this.sendTransactionBlocks(txBlocks);
  }

  /** Send every transaction in txs in parallel, returning when all transactions have completed. */
  private async sendTransactionBlocks(txs: Transaction[]): Promise<void[]> {
    return Promise.all(txs.map((tx) => this.sendTransactionBlock(tx)));
  }

  /** Send a single transaction block using a gas coin from the pool. */
  private async sendTransactionBlock(tx: Transaction): Promise<void> {
    const gasObject = this.gasPool.shift();
    if (gasObject === undefined) {
      this.logger.warn("No available gas coin. Skipping push.");
      return;
    }

    let nextGasObject: SuiObjectRef | undefined = undefined;
    try {
      tx.setGasPayment([gasObject]);
      tx.setGasBudget(this.gasBudget);
      const result = await this.provider.signAndExecuteTransaction({
        signer: this.signer,
        transaction: tx,
        options: {
          showEffects: true,
        },
      });

      nextGasObject = result.effects?.mutated
        ?.map((obj) => obj.reference)
        .find((ref) => ref.objectId === gasObject.objectId);

      this.logger.info(
        { hash: result.digest },
        "Successfully updated price with transaction digest",
      );
    } catch (err: any) {
      if (
        String(err).includes("Balance of gas object") ||
        String(err).includes("GasBalanceTooLow")
      ) {
        this.logger.error(err, "Insufficient gas balance");
        // If the error is caused by insufficient gas, we should panic
        throw err;
      } else {
        this.logger.error(
          err,
          "Failed to update price. Trying to refresh gas object references.",
        );
        // Refresh the coin object here in case the error is caused by an object version mismatch.
        nextGasObject = await SuiPricePusher.tryRefreshObjectReference(
          this.provider,
          gasObject,
        );
      }
    }

    if (nextGasObject !== undefined) {
      this.gasPool.push(nextGasObject);
    }
  }

  // This function will smash all coins owned by the signer into one, and then
  // split them equally into numGasObjects.
  // ignoreGasObjects is a list of gas objects that will be ignored during the
  // merging -- use this to store any locked objects on initialization.
  private static async initializeGasPool(
    signer: Ed25519Keypair,
    provider: SuiClient,
    numGasObjects: number,
    ignoreGasObjects: string[],
    logger: Logger,
  ): Promise<SuiObjectRef[]> {
    const signerAddress = signer.toSuiAddress();

    if (ignoreGasObjects.length > 0) {
      logger.info(
        { ignoreGasObjects },
        "Ignoring some gas objects for coin merging",
      );
    }

    const consolidatedCoin = await SuiPricePusher.mergeGasCoinsIntoOne(
      signer,
      provider,
      signerAddress,
      ignoreGasObjects,
      logger,
    );
    const coinResult = await provider.getObject({
      id: consolidatedCoin.objectId,
      options: { showContent: true },
    });
    let balance;
    if (
      coinResult.data &&
      coinResult.data.content &&
      coinResult.data.content.dataType == "moveObject"
    ) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      balance = coinResult.data.content.fields.balance;
    } else throw new Error("Bad coin object");
    const splitAmount =
      (BigInt(balance) - BigInt(GAS_FEE_FOR_SPLIT)) / BigInt(numGasObjects);

    const gasPool = await SuiPricePusher.splitGasCoinEqually(
      signer,
      provider,
      signerAddress,
      Number(splitAmount),
      numGasObjects,
      consolidatedCoin,
    );
    logger.info({ gasPool }, "Gas pool is filled with coins");
    return gasPool;
  }

  // Attempt to refresh the version of the provided object reference to point to the current version
  // of the object. Throws an error if the object cannot be refreshed.
  private static async tryRefreshObjectReference(
    provider: SuiClient,
    ref: SuiObjectRef,
  ): Promise<SuiObjectRef> {
    const objectResponse = await provider.getObject({ id: ref.objectId });
    if (objectResponse.data !== undefined) {
      return {
        digest: objectResponse.data!.digest,
        objectId: objectResponse.data!.objectId,
        version: objectResponse.data!.version,
      };
    } else {
      throw new Error("Failed to refresh object reference");
    }
  }

  private static async getAllGasCoins(
    provider: SuiClient,
    owner: SuiAddress,
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
          }),
        ),
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
    signer: Ed25519Keypair,
    provider: SuiClient,
    signerAddress: SuiAddress,
    splitAmount: number,
    numGasObjects: number,
    gasCoin: SuiObjectRef,
  ): Promise<SuiObjectRef[]> {
    // TODO: implement chunking if numGasObjects exceeds MAX_NUM_CREATED_OBJECTS
    const tx = new Transaction();
    const coins = tx.splitCoins(
      tx.gas,
      Array.from({ length: numGasObjects }, () => tx.pure.u64(splitAmount)),
    );

    tx.transferObjects(
      Array.from({ length: numGasObjects }, (_, i) => coins[i]),
      tx.pure.address(signerAddress),
    );
    tx.setGasPayment([gasCoin]);
    const result = await provider.signAndExecuteTransaction({
      signer,
      transaction: tx,
      options: { showEffects: true },
    });
    const error = result?.effects?.status.error;
    if (error) {
      throw new Error(
        `Failed to initialize gas pool: ${error}. Try re-running the script`,
      );
    }
    const newCoins = result.effects!.created!.map((obj) => obj.reference);
    if (newCoins.length !== numGasObjects) {
      throw new Error(
        `Failed to initialize gas pool. Expected ${numGasObjects}, got: ${newCoins}`,
      );
    }
    return newCoins;
  }

  private static async mergeGasCoinsIntoOne(
    signer: Ed25519Keypair,
    provider: SuiClient,
    owner: SuiAddress,
    initialLockedAddresses: string[],
    logger: Logger,
  ): Promise<SuiObjectRef> {
    const gasCoins = await SuiPricePusher.getAllGasCoins(provider, owner);
    // skip merging if there is only one coin
    if (gasCoins.length === 1) {
      return gasCoins[0];
    }

    const gasCoinsChunks = chunkArray<SuiObjectRef>(
      gasCoins,
      MAX_NUM_GAS_OBJECTS_IN_PTB - 2,
    );
    let finalCoin;
    const lockedAddresses: Set<string> = new Set();
    initialLockedAddresses.forEach((value) => lockedAddresses.add(value));
    for (let i = 0; i < gasCoinsChunks.length; i++) {
      const mergeTx = new Transaction();
      let coins = gasCoinsChunks[i];
      coins = coins.filter((coin) => !lockedAddresses.has(coin.objectId));
      if (finalCoin) {
        coins = [finalCoin, ...coins];
      }
      mergeTx.setGasPayment(coins);
      let mergeResult;
      try {
        mergeResult = await provider.signAndExecuteTransaction({
          signer,
          transaction: mergeTx,
          options: { showEffects: true },
        });
      } catch (err) {
        logger.error(err, "Merge transaction failed with error");

        if (
          String(err).includes(
            "quorum of validators because of locked objects. Retried a conflicting transaction",
          )
        ) {
          Object.values((err as any).data).forEach((lockedObjects: any) => {
            lockedObjects.forEach((lockedObject: [string, number, string]) => {
              lockedAddresses.add(lockedObject[0]);
            });
          });
          // retry merging without the locked coins
          i--;
          continue;
        }
        throw err;
      }
      const error = mergeResult?.effects?.status.error;
      if (error) {
        throw new Error(
          `Failed to merge coins when initializing gas pool: ${error}. Try re-running the script`,
        );
      }
      finalCoin = mergeResult.effects!.mutated!.map((obj) => obj.reference)[0];
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
