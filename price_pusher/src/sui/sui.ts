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
  SharedObjectRef,
  getSharedObjectInitialVersion,
} from "@mysten/sui.js";

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
        id: priceInfoObjectId.objectId,
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

// Gas price is cached for one minute to balance minimal fetching and risk of stale prices
// across epoch boundaries.
const GAS_PRICE_CACHE_DURATION = 60 * 1000;

export class SuiPricePusher implements IPricePusher {
  private readonly signer: RawSigner;
  // Sui transactions can error if they're sent concurrently. This flag tracks whether an update is in-flight,
  // so we can skip sending another update at the same time.
  private isAwaitingTx: boolean;

  private gasPriceCache?: { price: bigint; expiry: number };
  private pythStateReference?: SharedObjectRef;
  private wormholeStateReference?: SharedObjectRef;

  constructor(
    private priceServiceConnection: PriceServiceConnection,
    private pythPackageId: string,
    private pythStateId: string,
    private wormholePackageId: string,
    private wormholeStateId: string,
    private priceFeedToPriceInfoObjectTableId: string,
    private maxVaasPerPtb: number,
    endpoint: string,
    mnemonic: string
  ) {
    this.signer = new RawSigner(
      Ed25519Keypair.deriveKeypair(mnemonic),
      new JsonRpcProvider(new Connection({ fullnode: endpoint }))
    );
    this.isAwaitingTx = false;
  }

  async getGasPrice() {
    if (this.gasPriceCache && this.gasPriceCache.expiry > Date.now()) {
      return this.gasPriceCache.price;
    }

    const price = await this.signer.provider.getReferenceGasPrice();
    this.gasPriceCache = {
      price,
      expiry: Date.now() + GAS_PRICE_CACHE_DURATION,
    };

    return price;
  }

  async resolveSharedReferences() {
    if (!this.pythStateReference || !this.wormholeStateReference) {
      const [pythStateObject, wormholeStateObject] =
        await this.signer.provider.multiGetObjects({
          ids: [this.pythStateId, this.wormholeStateId],
          options: { showOwner: true },
        });

      this.pythStateReference = {
        objectId: this.pythStateId,
        initialSharedVersion: getSharedObjectInitialVersion(pythStateObject)!,
        mutable: false,
      };

      this.wormholeStateReference = {
        objectId: this.wormholeStateId,
        initialSharedVersion:
          getSharedObjectInitialVersion(wormholeStateObject)!,
        mutable: false,
      };
    }

    return {
      pythStateReference: this.pythStateReference,
      wormholeStateReference: this.wormholeStateReference,
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

    if (this.isAwaitingTx) {
      console.log(
        "Skipping update: previous price update transaction(s) have not completed."
      );
      return;
    }

    const priceFeeds = await this.priceServiceConnection.getLatestPriceFeeds(
      priceIds
    );
    if (priceFeeds === undefined) {
      console.log("Failed to fetch price updates. Skipping push.");
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

    try {
      this.isAwaitingTx = true;
      await this.sendTransactionBlocks(txs);
    } finally {
      this.isAwaitingTx = false;
    }
  }

  private async createPriceUpdateTransaction(
    vaas: string[],
    priceIds: string[]
  ): Promise<TransactionBlock | undefined> {
    const { pythStateReference, wormholeStateReference } =
      await this.resolveSharedReferences();

    const tx = new TransactionBlock();
    // Parse our batch price attestation VAA bytes using Wormhole.
    // Check out the Wormhole cross-chain bridge and generic messaging protocol here:
    //     https://github.com/wormhole-foundation/wormhole
    let verified_vaas: any = [];
    for (const vaa of vaas) {
      const [verified_vaa] = tx.moveCall({
        target: `${this.wormholePackageId}::vaa::parse_and_verify`,
        arguments: [
          tx.sharedObjectRef(wormholeStateReference),
          tx.pure(new Uint8Array(Buffer.from(vaa, "base64"))),
          tx.sharedObjectRef({
            objectId: SUI_CLOCK_OBJECT_ID,
            initialSharedVersion: 1,
            mutable: false,
          }),
        ],
      });
      verified_vaas = verified_vaas.concat(verified_vaa);
    }

    // Create a hot potato vector of price feed updates that will
    // be used to update price feeds.
    let [price_updates_hot_potato] = tx.moveCall({
      target: `${this.pythPackageId}::pyth::create_price_infos_hot_potato`,
      arguments: [
        tx.sharedObjectRef(pythStateReference),
        tx.makeMoveVec({
          type: `${this.wormholePackageId}::vaa::VAA`,
          objects: verified_vaas,
        }),
        tx.sharedObjectRef({
          objectId: SUI_CLOCK_OBJECT_ID,
          initialSharedVersion: 1,
          mutable: false,
        }),
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
          tx.sharedObjectRef(pythStateReference),
          price_updates_hot_potato,
          tx.sharedObjectRef(priceInfoObjectId),
          coin,
          tx.sharedObjectRef({
            objectId: SUI_CLOCK_OBJECT_ID,
            initialSharedVersion: 1,
            mutable: false,
          }),
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

  /** Send every transaction in txs sequentially, returning when all transactions have completed. */
  private async sendTransactionBlocks(txs: TransactionBlock[]): Promise<void> {
    const gasPrice = await this.getGasPrice();

    for (const tx of txs) {
      try {
        tx.setGasPrice(gasPrice);
        const result = await this.signer.signAndExecuteTransactionBlock({
          transactionBlock: tx,
          options: {
            showInput: true,
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
            showBalanceChanges: true,
          },
        });

        // In the event of a transaction failure, remove the gas price cache just in case it was a gas-price-related issue:
        if (result.effects?.status.status === "failure") {
          this.gasPriceCache = undefined;
        }

        console.log(
          "Successfully updated price with transaction digest ",
          result.digest
        );
      } catch (e) {
        console.log("Error when signAndExecuteTransactionBlock");
        if (String(e).includes("GasBalanceTooLow")) {
          console.log("Insufficient Gas Amount. Please top up your account");
          process.exit();
        }
        console.error(e);
      }
    }
  }
}

// We are calculating stored price info object id for given price id
// The mapping between which is static. Hence, we are caching it here.
const CACHE: { [priceId: string]: SharedObjectRef } = {};

// For given priceid, this method will fetch the price info object id
// where the price information for the corresponding price feed is stored
async function priceIdToPriceInfoObjectId(
  provider: JsonRpcProvider,
  pythPackageId: string,
  priceFeedToPriceInfoObjectTableId: string,
  priceId: string
): Promise<SharedObjectRef> {
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

  const object = await provider.getObject({
    id: priceInfoObjectId,
    options: { showOwner: true },
  });

  // cache the price info object id
  CACHE[priceId] = {
    objectId: priceInfoObjectId,
    initialSharedVersion: getSharedObjectInitialVersion(object)!,
    mutable: true,
  };

  return CACHE[priceId];
}
