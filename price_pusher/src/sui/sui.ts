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

  // This method is closely linked to how data structure are stored on Sui.
  // Any change in contracts or in Sui can possible break it.
  // We will have to update it accordingly then.
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
        throw new Error("fetched object datatype should be mmoveObject");

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
  constructor(
    private priceServiceConnection: PriceServiceConnection,
    private pythPackageId: string,
    private pythStateId: string,
    private wormholePackageId: string,
    private wormholeStateId: string,
    private priceFeedToPriceInfoObjectTableId: string,
    endpoint: string,
    mnemonic: string
  ) {
    this.signer = new RawSigner(
      Ed25519Keypair.deriveKeypair(mnemonic),
      new JsonRpcProvider(new Connection({ fullnode: endpoint }))
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

    const tx = new TransactionBlock();

    const vaas = await this.priceServiceConnection.getLatestVaas(priceIds);

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
        return;
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
      return;
    }
  }
}

// For given priceid, this method will fetch the price info object id
// where the price information for the corresponding price feed is stored
async function priceIdToPriceInfoObjectId(
  provider: JsonRpcProvider,
  pythPackageId: string,
  priceFeedToPriceInfoObjectTableId: string,
  priceId: string
) {
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

  return priceInfoObjectId;
}
