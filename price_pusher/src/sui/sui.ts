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
  SUI_CLOCK_OBJECT_ID,
  getCreatedObjects,
  SuiObjectRef,
  getTransactionEffects,
  getExecutionStatusError,
  PaginatedCoins,
  SuiAddress,
} from "@mysten/sui.js";

const GAS_FEE_FOR_SPLIT = 2_000_000_000;
// TODO: read this from on chain config
const MAX_NUM_GAS_OBJECTS_IN_PTB = 256;
const MAX_NUM_OBJECTS_IN_ARGUMENT = 510;
export class SuiPriceListener extends ChainPriceListener {
  constructor(
    private pythPackageId: string,
    private priceFeedToPriceInfoObjectTableId: string,
    private endpoint: string,
    priceItems: PriceItem[],
    config: {
      pollingFrequency: DurationInSeconds;
    }
  ) {
    super("sui", config.pollingFrequency, priceItems);
  }

  async getOnChainPriceInfo(priceId: string): Promise<PriceInfo | undefined> {
    try {
      const provider = new JsonRpcProvider(
        new Connection({ fullnode: this.endpoint })
      );

      const priceInfoObjectId = await priceIdToPriceInfoObjectId(
        provider,
        this.pythPackageId,
        this.priceFeedToPriceInfoObjectTableId,
        priceId
      );

      // Fetching the price info object for the above priceInfoObjectId
      const priceInfoObject = await provider.getObject({
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

export class SuiPricePusher implements IPricePusher {
  constructor(
    private readonly signer: RawSigner,
    private priceServiceConnection: PriceServiceConnection,
    private pythPackageId: string,
    private pythStateId: string,
    private wormholePackageId: string,
    private wormholeStateId: string,
    private priceFeedToPriceInfoObjectTableId: string,
    private maxVaasPerPtb: number,
    endpoint: string,
    mnemonic: string,
    private gasBudget: number,
    private gasPool: SuiObjectRef[]
  ) {}

  /**
   * Create a price pusher with a pool of `numGasObjects` gas coins that will be used to send transactions.
   * The gas coins of the wallet for the provided mnemonic will be merged and then evenly split into `numGasObjects`.
   */
  static async createWithAutomaticGasPool(
    priceServiceConnection: PriceServiceConnection,
    pythPackageId: string,
    pythStateId: string,
    wormholePackageId: string,
    wormholeStateId: string,
    priceFeedToPriceInfoObjectTableId: string,
    maxVaasPerPtb: number,
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

    const signer = new RawSigner(
      Ed25519Keypair.deriveKeypair(mnemonic),
      new JsonRpcProvider(new Connection({ fullnode: endpoint }))
    );

    const gasPool = await SuiPricePusher.initializeGasPool(
      signer,
      numGasObjects
    );

    return new SuiPricePusher(
      signer,
      priceServiceConnection,
      pythPackageId,
      pythStateId,
      wormholePackageId,
      wormholeStateId,
      priceFeedToPriceInfoObjectTableId,
      maxVaasPerPtb,
      endpoint,
      mnemonic,
      gasBudget,
      gasPool
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

    const priceFeeds = await this.priceServiceConnection.getLatestPriceFeeds(
      priceIds
    );
    if (priceFeeds === undefined) {
      console.warn("Failed to fetch price updates. Skipping push.");
      return;
    }

    const vaaToPriceFeedIds: Map<string, string[]> = new Map();
    for (const priceFeed of priceFeeds) {
      // The ! will succeed as long as the priceServiceConnection is configured to return binary vaa data (which it is).
      const vaa = priceFeed.getVAA()!;
      if (!vaaToPriceFeedIds.has(vaa)) {
        vaaToPriceFeedIds.set(vaa, []);
      }
      vaaToPriceFeedIds.get(vaa)!.push(priceFeed.id);
    }

    const txs = [];
    let currentBatchVaas = [];
    let currentBatchPriceFeedIds = [];
    for (const [vaa, priceFeedIds] of vaaToPriceFeedIds.entries()) {
      currentBatchVaas.push(vaa);
      currentBatchPriceFeedIds.push(...priceFeedIds);
      if (currentBatchVaas.length >= this.maxVaasPerPtb) {
        const tx = await this.createPriceUpdateTransaction(
          currentBatchVaas,
          currentBatchPriceFeedIds
        );
        if (tx !== undefined) {
          txs.push(tx);
        }

        currentBatchVaas = [];
        currentBatchPriceFeedIds = [];
      }
    }

    await this.sendTransactionBlocks(txs);
  }

  private async createPriceUpdateTransaction(
    vaas: string[],
    priceIds: string[]
  ): Promise<TransactionBlock | undefined> {
    const tx = new TransactionBlock();
    // Parse our batch price attestation VAA bytes using Wormhole.
    // Check out the Wormhole cross-chain bridge and generic messaging protocol here:
    //     https://github.com/wormhole-foundation/wormhole
    let verified_vaas: any = [];
    for (const vaa of vaas) {
      const [verified_vaa] = tx.moveCall({
        target: `${this.wormholePackageId}::vaa::parse_and_verify`,
        arguments: [
          tx.object(this.wormholeStateId),
          tx.pure([...Buffer.from(vaa, "base64")]),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
      verified_vaas = verified_vaas.concat(verified_vaa);
    }

    // Create a hot potato vector of price feed updates that will
    // be used to update price feeds.
    let [price_updates_hot_potato] = tx.moveCall({
      target: `${this.pythPackageId}::pyth::create_price_infos_hot_potato`,
      arguments: [
        tx.object(this.pythStateId),
        tx.makeMoveVec({
          type: `${this.wormholePackageId}::vaa::VAA`,
          objects: verified_vaas,
        }),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    // Update each price info object (containing our price feeds of interest)
    // using the hot potato vector.
    for (const priceId of priceIds) {
      let priceInfoObjectId;
      try {
        priceInfoObjectId = await priceIdToPriceInfoObjectId(
          this.signer.provider,
          this.pythPackageId,
          this.priceFeedToPriceInfoObjectTableId,
          priceId
        );
      } catch (e) {
        console.log("Error fetching price info object id for ", priceId);
        console.error(e);
        return undefined;
      }
      const coin = tx.splitCoins(tx.gas, [tx.pure(1)]);
      [price_updates_hot_potato] = tx.moveCall({
        target: `${this.pythPackageId}::pyth::update_single_price_feed`,
        arguments: [
          tx.object(this.pythStateId),
          price_updates_hot_potato,
          tx.object(priceInfoObjectId),
          coin,
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
    }

    // Explicitly destroy the hot potato vector, since it can't be dropped
    // automatically.
    tx.moveCall({
      target: `${this.pythPackageId}::hot_potato_vector::destroy`,
      arguments: [price_updates_hot_potato],
      typeArguments: [`${this.pythPackageId}::price_info::PriceInfo`],
    });

    return tx;
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
    const { totalBalance: balance } = await signer.provider.getBalance({
      owner: signerAddress,
    });
    const splitAmount =
      (BigInt(balance) - BigInt(GAS_FEE_FOR_SPLIT)) / BigInt(numGasObjects);

    const consolidatedCoin = await SuiPricePusher.mergeGasCoinsIntoOne(
      signer,
      signerAddress
    );

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

    for (let i = 0; i < gasCoinsChunks.length; i++) {
      const mergeTx = new TransactionBlock();
      let coins = gasCoinsChunks[i];
      if (finalCoin) {
        coins = [finalCoin, ...coins];
      }
      mergeTx.setGasPayment(coins);
      const mergeResult = await signer.signAndExecuteTransactionBlock({
        transactionBlock: mergeTx,
        options: { showEffects: true },
      });
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

// We are calculating stored price info object id for given price id
// The mapping between which is static. Hence, we are caching it here.
const CACHE: { [priceId: string]: string } = {};

// For given priceid, this method will fetch the price info object id
// where the price information for the corresponding price feed is stored
async function priceIdToPriceInfoObjectId(
  provider: JsonRpcProvider,
  pythPackageId: string,
  priceFeedToPriceInfoObjectTableId: string,
  priceId: string
) {
  // Check if this was fetched before.
  if (CACHE[priceId] !== undefined) return CACHE[priceId];

  const storedObjectID = await provider.getDynamicFieldObject({
    parentId: priceFeedToPriceInfoObjectTableId,
    name: {
      type: `${pythPackageId}::price_identifier::PriceIdentifier`,
      value: {
        bytes: "0x" + priceId,
      },
    },
  });

  if (storedObjectID.error !== undefined) throw storedObjectID.error;

  if (
    storedObjectID.data === undefined ||
    storedObjectID.data.content === undefined
  )
    throw new Error("Price not found on chain for price id " + priceId);

  if (storedObjectID.data.content.dataType !== "moveObject")
    throw new Error("fetched object datatype should be moveObject");
  // This ID points to the price info object for the given price id stored on chain
  const priceInfoObjectId = storedObjectID.data.content.fields.value;

  // cache the price info object id
  CACHE[priceId] = priceInfoObjectId;

  return priceInfoObjectId;
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
