/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-console */
import { Buffer } from "node:buffer";

import { bcs } from "@mysten/sui/bcs";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import type { HexString } from "@pythnetwork/hermes-client";

const MAX_ARGUMENT_SIZE = 16 * 1024;
type NestedTransactionResult = {
  $kind: "NestedResult";
  NestedResult: [number, number];
};
export type ObjectId = string;

export class SuiPythClient {
  private pythPackageId: ObjectId | undefined;
  private wormholePackageId: ObjectId | undefined;
  private priceTableInfo: { id: ObjectId; fieldType: ObjectId } | undefined;
  private priceFeedObjectIdCache = new Map<HexString, ObjectId>();
  private baseUpdateFee: number | undefined;
  constructor(
    public provider: SuiClient,
    public pythStateId: ObjectId,
    public wormholeStateId: ObjectId,
  ) {
    this.pythPackageId = undefined;
    this.wormholePackageId = undefined;
  }

  async getBaseUpdateFee(): Promise<number> {
    if (this.baseUpdateFee === undefined) {
      const result = await this.provider.getObject({
        id: this.pythStateId,
        options: { showContent: true },
      });
      if (
        !result.data?.content ||
        result.data.content.dataType !== "moveObject"
      )
        throw new Error("Unable to fetch pyth state object");
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.baseUpdateFee = result.data.content.fields.base_update_fee as number;
    }

    return this.baseUpdateFee;
  }

  /**
   * getPackageId returns the latest package id that the object belongs to. Use this to
   * fetch the latest package id for a given object id and handle package upgrades automatically.
   * @param objectId - the object id
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
        console.log(result.data?.content);

        throw new Error(`Cannot fetch package id for object ${objectId}`);
      });

    if ("upgrade_cap" in state) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      return state.upgrade_cap.fields.package;
    }

    throw new Error("upgrade_cap not found");
  }

  /**
   * Adds the commands for calling wormhole and verifying the vaas and returns the verified vaas.
   * @param vaas - array of vaas to verify
   * @param tx - transaction block to add commands to
   */
  async verifyVaas(vaas: Buffer[], tx: Transaction) {
    const wormholePackageId = await this.getWormholePackageId();
    const verifiedVaas = [];
    for (const vaa of vaas) {
      const [verifiedVaa] = tx.moveCall({
        target: `${wormholePackageId}::vaa::parse_and_verify`,
        arguments: [
          tx.object(this.wormholeStateId),
          tx.pure(
            bcs
              .vector(bcs.U8)
              .serialize([...vaa], {
                maxSize: MAX_ARGUMENT_SIZE,
              })
              .toBytes(),
          ),
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
      verifiedVaas.push(verifiedVaa);
    }
    return verifiedVaas;
  }

  async verifyVaasAndGetHotPotatoes(
    tx: Transaction,
    updates: Buffer[],
    packageId: string,
  ): Promise<{
    hotPotatoes: NestedTransactionResult[];
    feedIdsPerUpdate: string[][];
  }> {
    const hotPotatoes: NestedTransactionResult[] = [];
    const feedIdsPerUpdate: string[][] = [];

    for (const update of updates) {
      const vaa = this.extractVaaBytesFromAccumulatorMessage(update);
      const verifiedVaas = await this.verifyVaas([vaa], tx);
      const feedIds = this.extractPriceFeedIdsFromAccumulatorMessage(update);
      feedIdsPerUpdate.push(feedIds);

      const [priceUpdatesHotPotato] = tx.moveCall({
        target: `${packageId}::pyth::create_authenticated_price_infos_using_accumulator`,
        arguments: [
          tx.object(this.pythStateId),
          tx.pure(
            bcs
              .vector(bcs.U8)
              .serialize([...update], {
                maxSize: MAX_ARGUMENT_SIZE,
              })
              .toBytes(),
          ),
          verifiedVaas[0]!,
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
      hotPotatoes.push(priceUpdatesHotPotato!);
    }

    return { hotPotatoes, feedIdsPerUpdate };
  }

  async executePriceFeedUpdatesMultiple(
    tx: Transaction,
    packageId: string,
    feedIds: HexString[],
    hotPotatoes: NestedTransactionResult[],
    feedIdsPerUpdate: string[][],
    coins: NestedTransactionResult[],
  ) {
    const priceInfoObjects: ObjectId[] = [];
    const normalizedFeedIds: string[] = [];
    for (const id of feedIds) {
      normalizedFeedIds.push(id.replace("0x", ""));
    }

    // Build a map of feed ID to which hot potato index contains it
    const feedIdToHotPotatoIndex = new Map<string, number>();
    for (const [updateIndex, updateFeedIds] of feedIdsPerUpdate.entries()) {
      for (const feedId of updateFeedIds) {
        feedIdToHotPotatoIndex.set(feedId, updateIndex);
      }
    }

    // Track which hot potatoes we've used and their current state
    const hotPotatoStates = [...hotPotatoes];

    let coinId = 0;
    for (const feedId of normalizedFeedIds) {
      const priceInfoObjectId = await this.getPriceFeedObjectId(feedId);
      if (!priceInfoObjectId) {
        throw new Error(
          "Price feed " + feedId + " not found, please create it first",
        );
      }

      const hotPotatoIndex = feedIdToHotPotatoIndex.get(feedId);
      if (hotPotatoIndex === undefined) {
        throw new Error(
          "Price feed " +
            feedId +
            " not found in any of the provided accumulator messages",
        );
      }

      priceInfoObjects.push(priceInfoObjectId);
      const [updatedHotPotato] = tx.moveCall({
        target: `${packageId}::pyth::update_single_price_feed`,
        arguments: [
          tx.object(this.pythStateId),
          hotPotatoStates[hotPotatoIndex]!,
          tx.object(priceInfoObjectId),
          coins[coinId]!,
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
      hotPotatoStates[hotPotatoIndex] = updatedHotPotato!;
      coinId++;
    }

    // Destroy all hot potatoes
    for (const hotPotato of hotPotatoStates) {
      tx.moveCall({
        target: `${packageId}::hot_potato_vector::destroy`,
        arguments: [hotPotato],
        typeArguments: [`${packageId}::price_info::PriceInfo`],
      });
    }

    return priceInfoObjects;
  }

  /**
   * Adds the necessary commands for updating the pyth price feeds to the transaction block.
   * Supports multiple accumulator messages in a single transaction.
   * @param tx - transaction block to add commands to
   * @param updates - array of price feed updates received from the price service
   * @param feedIds - array of feed ids to update (in hex format)
   */
  async updatePriceFeeds(
    tx: Transaction,
    updates: Buffer[],
    feedIds: HexString[],
  ): Promise<ObjectId[]> {
    const packageId = await this.getPythPackageId();
    const { hotPotatoes, feedIdsPerUpdate } =
      await this.verifyVaasAndGetHotPotatoes(tx, updates, packageId);

    const baseUpdateFee = await this.getBaseUpdateFee();
    const coins = tx.splitCoins(
      tx.gas,
      feedIds.map(() => tx.pure.u64(baseUpdateFee)),
    );

    return await this.executePriceFeedUpdatesMultiple(
      tx,
      packageId,
      feedIds,
      hotPotatoes,
      feedIdsPerUpdate,
      coins,
    );
  }

  /**
   * Updates price feeds using the coin input for payment. Coins can be generated by calling splitCoin on tx.gas.
   * Supports multiple accumulator messages in a single transaction.
   * @param tx - transaction block to add commands to
   * @param updates - array of price feed updates received from the price service
   * @param feedIds - array of feed ids to update (in hex format)
   * @param coins - array of Coins for payment of update operations
   */
  async updatePriceFeedsWithCoins(
    tx: Transaction,
    updates: Buffer[],
    feedIds: HexString[],
    coins: NestedTransactionResult[],
  ): Promise<ObjectId[]> {
    const packageId = await this.getPythPackageId();
    const { hotPotatoes, feedIdsPerUpdate } =
      await this.verifyVaasAndGetHotPotatoes(tx, updates, packageId);

    return await this.executePriceFeedUpdatesMultiple(
      tx,
      packageId,
      feedIds,
      hotPotatoes,
      feedIdsPerUpdate,
      coins,
    );
  }

  /**
   * Creates price feeds from accumulator messages.
   * Supports multiple accumulator messages in a single transaction.
   * @param tx - transaction block to add commands to
   * @param updates - array of price feed updates received from the price service
   */
  async createPriceFeed(tx: Transaction, updates: Buffer[]) {
    const packageId = await this.getPythPackageId();

    for (const update of updates) {
      const vaa = this.extractVaaBytesFromAccumulatorMessage(update);
      const verifiedVaas = await this.verifyVaas([vaa], tx);
      tx.moveCall({
        target: `${packageId}::pyth::create_price_feeds_using_accumulator`,
        arguments: [
          tx.object(this.pythStateId),
          tx.pure(
            bcs
              .vector(bcs.U8)
              .serialize([...update], {
                maxSize: MAX_ARGUMENT_SIZE,
              })
              .toBytes(),
          ),
          verifiedVaas[0]!,
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
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
   * @param feedId - the feed id
   */
  async getPriceFeedObjectId(feedId: HexString): Promise<ObjectId | undefined> {
    const normalizedFeedId = feedId.replace("0x", "");
    if (!this.priceFeedObjectIdCache.has(normalizedFeedId)) {
      const { id: tableId, fieldType } = await this.getPriceTableInfo();
      const result = await this.provider.getDynamicFieldObject({
        parentId: tableId,
        name: {
          type: `${fieldType}::price_identifier::PriceIdentifier`,
          value: {
            bytes: [...Buffer.from(normalizedFeedId, "hex")],
          },
        },
      });
      if (!result.data?.content) {
        return undefined;
      }
      if (result.data.content.dataType !== "moveObject") {
        throw new Error("Price feed type mismatch");
      }
      this.priceFeedObjectIdCache.set(
        normalizedFeedId,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        result.data.content.fields.value,
      );
    }
    return this.priceFeedObjectIdCache.get(normalizedFeedId);
  }

  /**
   * Fetches the price table object id for the current state id if not cached
   * @returns price table object id
   */
  async getPriceTableInfo(): Promise<{ id: ObjectId; fieldType: ObjectId }> {
    if (this.priceTableInfo === undefined) {
      const result = await this.provider.getDynamicFieldObject({
        parentId: this.pythStateId,
        name: {
          type: "vector<u8>",
          value: "price_info",
        },
      });
      if (!result.data?.type) {
        throw new Error(
          "Price Table not found, contract may not be initialized",
        );
      }
      let type = result.data.type.replace("0x2::table::Table<", "");
      type = type.replace(
        "::price_identifier::PriceIdentifier, 0x2::object::ID>",
        "",
      );
      this.priceTableInfo = { id: result.data.objectId, fieldType: type };
    }
    return this.priceTableInfo;
  }

  /**
   * Obtains the vaa bytes embedded in an accumulator message.
   * @param accumulatorMessage - the accumulator price update message
   * @returns vaa bytes as a uint8 array
   */
  extractVaaBytesFromAccumulatorMessage(accumulatorMessage: Buffer): Buffer {
    // the first 6 bytes in the accumulator message encode the header, major, and minor bytes
    // we ignore them, since we are only interested in the VAA bytes
    const trailingPayloadSize = accumulatorMessage.readUint8(6);
    const vaaSizeOffset =
      7 + // header bytes (header(4) + major(1) + minor(1) + trailing payload size(1))
      trailingPayloadSize + // trailing payload (variable number of bytes)
      1; // proof_type (1 byte)
    const vaaSize = accumulatorMessage.readUint16BE(vaaSizeOffset);
    const vaaOffset = vaaSizeOffset + 2;
    return accumulatorMessage.subarray(vaaOffset, vaaOffset + vaaSize);
  }

  /**
   * Extracts the price feed IDs from an accumulator message.
   * @param accumulatorMessage - the accumulator price update message
   * @returns array of price feed IDs (as hex strings without 0x prefix)
   */
  extractPriceFeedIdsFromAccumulatorMessage(
    accumulatorMessage: Buffer,
  ): string[] {
    const trailingPayloadSize = accumulatorMessage.readUint8(6);
    const vaaSizeOffset =
      7 + // header bytes (header(4) + major(1) + minor(1) + trailing payload size(1))
      trailingPayloadSize + // trailing payload (variable number of bytes)
      1; // proof_type (1 byte)
    const vaaSize = accumulatorMessage.readUint16BE(vaaSizeOffset);
    const vaaOffset = vaaSizeOffset + 2;

    // Skip past the VAA to get to the price updates section
    let offset = vaaOffset + vaaSize;

    // Read the number of updates
    const updateSize = accumulatorMessage.readUint8(offset);
    offset += 1;

    const feedIds: string[] = [];

    for (let i = 0; i < updateSize; i++) {
      // Read message size (2 bytes, big-endian)
      const messageSize = accumulatorMessage.readUint16BE(offset);
      offset += 2;

      // Read message type (1 byte) - should be 0 for price feed message
      const messageType = accumulatorMessage.readUint8(offset);
      if (messageType === 0) {
        // Price feed message type
        // Price identifier is the next 32 bytes after message type
        const priceIdentifier = accumulatorMessage
          .subarray(offset + 1, offset + 1 + 32)
          .toString("hex");
        feedIds.push(priceIdentifier);
      }

      // Skip the message content
      offset += messageSize;

      // Skip the merkle proof
      // Proof format: proof_size (1 byte) + proof_size * 20 bytes
      const proofSize = accumulatorMessage.readUint8(offset);
      offset += 1 + proofSize * 20;
    }

    return feedIds;
  }
}
