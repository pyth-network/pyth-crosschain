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
  private readonly signer: RawSigner;
  // Sui transactions can error if they're sent concurrently. This flag tracks whether an update is in-flight,
  // so we can skip sending another update at the same time.
  private isAwaitingTx: boolean;

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

    const vaaToPriceFeedIds: Record<string, string[]> = {};
    for (const priceFeed of priceFeeds) {
      // The ! will succeed as long as the priceServiceConnection is configured to return binary vaa data (which it is).
      const vaa = priceFeed.getVAA()!;
      if (vaaToPriceFeedIds[vaa] === undefined) {
        vaaToPriceFeedIds[vaa] = [];
      }
      vaaToPriceFeedIds[vaa].push(priceFeed.id);
    }

    const txs = [];
    let currentBatchVaas = [];
    let currentBatchPriceFeedIds = [];
    for (const [vaa, priceFeedIds] of Object.entries(vaaToPriceFeedIds)) {
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

  /** Send every transaction in txs sequentially, returning when all transactions have completed. */
  private async sendTransactionBlocks(txs: TransactionBlock[]): Promise<void> {
    for (const tx of txs) {
      try {
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
