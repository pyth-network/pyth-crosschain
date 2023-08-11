import {
  JsonRpcProvider,
  ObjectId,
  SUI_CLOCK_OBJECT_ID,
  TransactionBlock,
} from "@mysten/sui.js";
import { HexString } from "@pythnetwork/price-service-client";

export class SuiPythClient {
  private pythPackageId: ObjectId | undefined;
  private wormholePackageId: ObjectId | undefined;
  private priceTableId: ObjectId | undefined;
  private priceFeedObjectIdCache: Map<HexString, ObjectId> = new Map();
  constructor(
    public provider: JsonRpcProvider,
    public pythStateId: ObjectId,
    public wormholeStateId: ObjectId
  ) {
    this.pythPackageId = undefined;
    this.wormholePackageId = undefined;
  }

  /**
   * getPackageId returns the latest package id that the object belongs to. Use this to
   * fetch the latest package id for a given object id and handle package upgrades automatically.
   * @param objectId
   * @returns package id
   */
  async getPackageId(objectId: ObjectId): Promise<ObjectId> {
    const state = await this.provider
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
   * Adds the commands for calling wormhole and verifying the vaas and returns the verified vaas.
   * @param vaas array of vaas to verify
   * @param tx transaction block to add commands to
   */
  async verifyVaas(vaas: number[][], tx: TransactionBlock) {
    const wormholePackageId = await this.getWormholePackageId();
    const verifiedVaas = [];
    for (const vaa of vaas) {
      const [verifiedVaa] = tx.moveCall({
        target: `${wormholePackageId}::vaa::parse_and_verify`,
        arguments: [
          tx.object(this.wormholeStateId),
          tx.pure(vaa),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
      verifiedVaas.push(verifiedVaa);
    }
    return verifiedVaas;
  }

  /**
   * Adds the necessary commands for updating the pyth price feeds to the transaction block.
   * @param tx transaction block to add commands to
   * @param updates array of price feed updates received from the price service
   * @param feedIds array of feed ids to update (in hex format)
   */
  async updatePriceFeeds(
    tx: TransactionBlock,
    updates: number[][],
    feedIds: HexString[]
  ): Promise<ObjectId[]> {
    const wormholePackageId = await this.getWormholePackageId();
    const packageId = await this.getPythPackageId();

    let priceUpdatesHotPotato;
    if (updates.every((update) => this.isAccumulatorMsg(update))) {
      if (updates.length > 1) {
        throw new Error(
          "SDK does not support sending multiple accumulator messages in a single transaction"
        );
      }
      const vaa = this.extractVaaBytesFromAccumulatorMessage(updates[0]);
      const verifiedVaas = await this.verifyVaas([vaa], tx);
      [priceUpdatesHotPotato] = tx.moveCall({
        target: `${packageId}::pyth::create_authenticated_price_infos_using_accumulator`,
        arguments: [
          tx.object(this.pythStateId),
          tx.pure(updates[0]),
          verifiedVaas[0],
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
    } else if (updates.every((vaa) => !this.isAccumulatorMsg(vaa))) {
      const verifiedVaas = await this.verifyVaas(updates, tx);
      [priceUpdatesHotPotato] = tx.moveCall({
        target: `${packageId}::pyth::create_price_infos_hot_potato`,
        arguments: [
          tx.object(this.pythStateId),
          tx.makeMoveVec({
            type: `${wormholePackageId}::vaa::VAA`,
            objects: verifiedVaas,
          }),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
    } else {
      throw new Error("Can't mix accumulator and non-accumulator messages");
    }

    const priceInfoObjects: ObjectId[] = [];
    for (const feedId of feedIds) {
      const priceInfoObjectId = await this.getPriceFeedObjectId(feedId);
      if (!priceInfoObjectId) {
        throw new Error(
          `Price feed ${feedId} not found, please create it first`
        );
      }
      priceInfoObjects.push(priceInfoObjectId);
      const coin = tx.splitCoins(tx.gas, [tx.pure(1)]);
      [priceUpdatesHotPotato] = tx.moveCall({
        target: `${packageId}::pyth::update_single_price_feed`,
        arguments: [
          tx.object(this.pythStateId),
          priceUpdatesHotPotato,
          tx.object(priceInfoObjectId),
          coin,
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
    }
    tx.moveCall({
      target: `${packageId}::hot_potato_vector::destroy`,
      arguments: [priceUpdatesHotPotato],
      typeArguments: [`${packageId}::price_info::PriceInfo`],
    });
    return priceInfoObjects;
  }
  async createPriceFeed(tx: TransactionBlock, updates: number[][]) {
    const wormholePackageId = await this.getWormholePackageId();
    const packageId = await this.getPythPackageId();
    if (updates.every((update) => this.isAccumulatorMsg(update))) {
      if (updates.length > 1) {
        throw new Error(
          "SDK does not support sending multiple accumulator messages in a single transaction"
        );
      }
      const vaa = this.extractVaaBytesFromAccumulatorMessage(updates[0]);
      const verifiedVaas = await this.verifyVaas([vaa], tx);
      tx.moveCall({
        target: `${packageId}::pyth::create_price_feeds_using_accumulator`,
        arguments: [
          tx.object(this.pythStateId),
          tx.pure(updates[0]),
          verifiedVaas[0],
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
    } else if (updates.every((vaa) => !this.isAccumulatorMsg(vaa))) {
      const verifiedVaas = await this.verifyVaas(updates, tx);
      tx.moveCall({
        target: `${packageId}::pyth::create_price_feeds`,
        arguments: [
          tx.object(this.pythStateId),
          tx.makeMoveVec({
            type: `${wormholePackageId}::vaa::VAA`,
            objects: verifiedVaas,
          }),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
    } else {
      throw new Error("Can't mix accumulator and non-accumulator messages");
    }
  }

  /**
   * Get the packageId for the wormhole package if not already cached
   */
  async getWormholePackageId() {
    if (!this.wormholePackageId) {
      this.wormholePackageId = await this.getPackageId(this.wormholeStateId);
    }
    return this.wormholePackageId;
  }

  /**
   * Get the packageId for the pyth package if not already cached
   */
  async getPythPackageId() {
    if (!this.pythPackageId) {
      this.pythPackageId = await this.getPackageId(this.pythStateId);
    }
    return this.pythPackageId;
  }

  /**
   * Get the priceFeedObjectId for a given feedId if not already cached
   * @param feedId
   */
  async getPriceFeedObjectId(feedId: HexString): Promise<ObjectId | undefined> {
    const normalizedFeedId = feedId.replace("0x", "");
    if (!this.priceFeedObjectIdCache.has(normalizedFeedId)) {
      const tableId = await this.getPriceTableId();
      const result = await this.provider.getDynamicFieldObject({
        parentId: tableId,
        name: {
          type: `${await this.getPythPackageId()}::price_identifier::PriceIdentifier`,
          value: {
            bytes: Array.from(Buffer.from(normalizedFeedId, "hex")),
          },
        },
      });
      if (!result.data || !result.data.content) {
        return undefined;
      }
      if (result.data.content.dataType !== "moveObject") {
        throw new Error("Price feed type mismatch");
      }
      this.priceFeedObjectIdCache.set(
        normalizedFeedId,
        result.data.content.fields.value
      );
    }
    return this.priceFeedObjectIdCache.get(normalizedFeedId);
  }

  /**
   * Fetches the price table object id for the current state id if not cached
   * @returns price table object id
   */
  async getPriceTableId(): Promise<ObjectId> {
    if (this.priceTableId === undefined) {
      const result = await this.provider.getDynamicFieldObject({
        parentId: this.pythStateId,
        name: {
          type: "vector<u8>",
          value: "price_info",
        },
      });
      if (!result.data) {
        throw new Error(
          "Price Table not found, contract may not be initialized"
        );
      }
      this.priceTableId = result.data.objectId;
    }
    return this.priceTableId;
  }

  /**
   * Checks if a message is an accumulator message or not
   * @param msg - update message from price service
   */
  isAccumulatorMsg(msg: number[]) {
    const ACCUMULATOR_MAGIC = "504e4155";
    return Buffer.from(msg).toString("hex").slice(0, 8) === ACCUMULATOR_MAGIC;
  }

  /**
   * Obtains the vaa bytes embedded in an accumulator message.
   * @param accumulatorMessage - the accumulator price update message
   * @returns vaa bytes as a uint8 array
   */
  extractVaaBytesFromAccumulatorMessage(
    accumulatorMessage: number[]
  ): number[] {
    if (!this.isAccumulatorMsg(accumulatorMessage)) {
      throw new Error("Not an accumulator message");
    }
    // the first 6 bytes in the accumulator message encode the header, major, and minor bytes
    // we ignore them, since we are only interested in the VAA bytes
    const trailingPayloadSize = accumulatorMessage.slice(6, 7)[0];
    const vaaSizeOffset =
      7 + // header bytes (header(4) + major(1) + minor(1) + trailing payload size(1))
      trailingPayloadSize + // trailing payload (variable number of bytes)
      1; // proof_type (1 byte)
    const vaaSizeBytes = accumulatorMessage.slice(
      vaaSizeOffset,
      vaaSizeOffset + 2
    );
    const vaaSize = vaaSizeBytes[1] + 16 * vaaSizeBytes[0];
    const vaaOffset = vaaSizeOffset + 2;
    return accumulatorMessage.slice(vaaOffset, vaaOffset + vaaSize);
  }
}
