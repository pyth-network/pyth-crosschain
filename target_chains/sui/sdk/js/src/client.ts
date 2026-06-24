import { Buffer } from "node:buffer";

import { bcs } from "@mysten/sui/bcs";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";
import { parseStructTag, SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import type { HexString } from "@pythnetwork/hermes-client";

const MAX_ARGUMENT_SIZE = 16 * 1024;
type NestedTransactionResult = {
  $kind: "NestedResult";
  NestedResult: [number, number];
};
export type ObjectId = string;

/**
 * Any `@mysten/sui` v2 client exposes the unified `.core` API — this includes
 * both `SuiJsonRpcClient` (`@mysten/sui/jsonRpc`) and the experimental
 * `SuiGrpcClient` (`@mysten/sui/grpc`). `SuiPythClient` reads exclusively through
 * `.core` so it works transport-agnostically with either one.
 */
export type SuiPythClientProvider = ClientWithCoreApi;

/**
 * The `.core` JSON view represents a nested Move struct as `{ type, fields }`
 * over JSON-RPC but flattens it to a plain field map over gRPC. Return the inner
 * field map for either shape so callers can read fields transport-agnostically.
 */
function getStructFields(value: unknown): Record<string, unknown> {
  if (
    typeof value === "object" &&
    value !== null &&
    "fields" in value &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  ) {
    return (value as { fields: Record<string, unknown> }).fields;
  }
  return value as Record<string, unknown>;
}

export class SuiPythClient {
  private pythPackageId: ObjectId | undefined;
  private wormholePackageId: ObjectId | undefined;
  private priceTableInfo: { id: ObjectId; fieldType: ObjectId } | undefined;
  private priceFeedObjectIdCache = new Map<HexString, ObjectId>();
  private baseUpdateFee: number | undefined;
  constructor(
    public provider: SuiPythClientProvider,
    public pythStateId: ObjectId,
    public wormholeStateId: ObjectId,
  ) {
    this.pythPackageId = undefined;
    this.wormholePackageId = undefined;
  }

  async getBaseUpdateFee(): Promise<number> {
    if (this.baseUpdateFee === undefined) {
      const { object } = await this.provider.core.getObject({
        include: { json: true },
        objectId: this.pythStateId,
      });
      if (!object.json) {
        throw new Error("Unable to fetch pyth state object");
      }
      this.baseUpdateFee = Number(object.json.base_update_fee);
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
    const { object } = await this.provider.core.getObject({
      include: { json: true },
      objectId,
    });
    const state = object.json;
    if (!state) {
      throw new Error(`Cannot fetch package id for object ${objectId}`);
    }

    if ("upgrade_cap" in state) {
      return getStructFields(state.upgrade_cap).package as ObjectId;
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
        target: `${wormholePackageId}::vaa::parse_and_verify`,
      });
      verifiedVaas.push(verifiedVaa);
    }
    return verifiedVaas;
  }

  async verifyVaasAndGetHotPotato(
    tx: Transaction,
    updates: Buffer[],
    packageId: string,
  ): Promise<NestedTransactionResult> {
    if (updates.length > 1) {
      throw new Error(
        "SDK does not support sending multiple accumulator messages in a single transaction",
      );
    }
    const [update] = updates;
    if (update === undefined) {
      throw new Error("No accumulator message to verify");
    }
    const vaa = this.extractVaaBytesFromAccumulatorMessage(update);
    const [verifiedVaa] = await this.verifyVaas([vaa], tx);
    if (verifiedVaa === undefined) {
      throw new Error("Failed to verify the accumulator message");
    }
    const [priceUpdatesHotPotato] = tx.moveCall({
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
        verifiedVaa,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
      target: `${packageId}::pyth::create_authenticated_price_infos_using_accumulator`,
    });
    if (priceUpdatesHotPotato === undefined) {
      throw new Error("Failed to create the price updates hot potato");
    }
    return priceUpdatesHotPotato;
  }

  async executePriceFeedUpdates(
    tx: Transaction,
    packageId: string,
    feedIds: HexString[],
    // biome-ignore lint/suspicious/noExplicitAny: the hot potato is an opaque transaction argument threaded between move calls
    priceUpdatesHotPotato: any,
    coins: NestedTransactionResult[],
  ) {
    const priceInfoObjects: ObjectId[] = [];
    let coinId = 0;
    for (const feedId of feedIds) {
      const priceInfoObjectId = await this.getPriceFeedObjectId(feedId);
      if (!priceInfoObjectId) {
        throw new Error(
          `Price feed ${feedId} not found, please create it first`,
        );
      }
      priceInfoObjects.push(priceInfoObjectId);
      [priceUpdatesHotPotato] = tx.moveCall({
        arguments: [
          tx.object(this.pythStateId),
          priceUpdatesHotPotato,
          tx.object(priceInfoObjectId),
          coins[coinId],
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
        target: `${packageId}::pyth::update_single_price_feed`,
      });
      coinId++;
    }
    tx.moveCall({
      arguments: [priceUpdatesHotPotato],
      target: `${packageId}::hot_potato_vector::destroy`,
      typeArguments: [`${packageId}::price_info::PriceInfo`],
    });
    return priceInfoObjects;
  }

  /**
   * Adds the necessary commands for updating the pyth price feeds to the transaction block.
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
    const priceUpdatesHotPotato = await this.verifyVaasAndGetHotPotato(
      tx,
      updates,
      packageId,
    );

    const baseUpdateFee = await this.getBaseUpdateFee();
    const coins = tx.splitCoins(
      tx.gas,
      feedIds.map(() => tx.pure.u64(baseUpdateFee)),
    );

    return await this.executePriceFeedUpdates(
      tx,
      packageId,
      feedIds,
      priceUpdatesHotPotato,
      coins,
    );
  }

  /**
   * Updates price feeds using the coin input for payment. Coins can be generated by calling splitCoin on tx.gas.
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
    const priceUpdatesHotPotato = await this.verifyVaasAndGetHotPotato(
      tx,
      updates,
      packageId,
    );

    return await this.executePriceFeedUpdates(
      tx,
      packageId,
      feedIds,
      priceUpdatesHotPotato,
      coins,
    );
  }

  async createPriceFeed(tx: Transaction, updates: Buffer[]) {
    const packageId = await this.getPythPackageId();
    if (updates.length > 1) {
      throw new Error(
        "SDK does not support sending multiple accumulator messages in a single transaction",
      );
    }
    const [update] = updates;
    if (update === undefined) {
      throw new Error("No accumulator message to create a price feed from");
    }
    const vaa = this.extractVaaBytesFromAccumulatorMessage(update);
    const [verifiedVaa] = await this.verifyVaas([vaa], tx);
    if (verifiedVaa === undefined) {
      throw new Error("Failed to verify the accumulator message");
    }
    tx.moveCall({
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
        verifiedVaa,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
      target: `${packageId}::pyth::create_price_feeds_using_accumulator`,
    });
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
      // `PriceIdentifier` is a single-field `{ bytes: vector<u8> }` struct, so
      // its BCS encoding is identical to that of the inner `vector<u8>`.
      const name = bcs
        .vector(bcs.U8)
        .serialize([...Buffer.from(normalizedFeedId, "hex")])
        .toBytes();
      let dynamicField;
      try {
        ({ dynamicField } = await this.provider.core.getDynamicField({
          name: {
            bcs: name,
            type: `${fieldType}::price_identifier::PriceIdentifier`,
          },
          parentId: tableId,
        }));
      } catch {
        // The feed has not been registered yet — the dynamic field is absent.
        return undefined;
      }
      // The table value is an `0x2::object::ID`, i.e. a bare 32-byte address.
      this.priceFeedObjectIdCache.set(
        normalizedFeedId,
        bcs.Address.parse(dynamicField.value.bcs),
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
      // `price_info` is a dynamic *object* field on the pyth state (it holds a
      // `Table`), so it must be resolved through the `dynamic_object_field`
      // `Wrapper` name type. The field value is the `0x2::object::ID` of the
      // backing table object, which is the parent of the per-feed entries.
      const { dynamicField } = await this.provider.core.getDynamicField({
        name: {
          bcs: bcs.string().serialize("price_info").toBytes(),
          type: "0x2::dynamic_object_field::Wrapper<vector<u8>>",
        },
        parentId: this.pythStateId,
      });
      const tableId = bcs.Address.parse(dynamicField.value.bcs);
      // The table's type is `0x2::table::Table<<pkg>::price_identifier::PriceIdentifier, 0x2::object::ID>`;
      // the first type parameter carries the package that defines `PriceIdentifier`.
      const { object } = await this.provider.core.getObject({
        objectId: tableId,
      });
      const keyType = parseStructTag(object.type).typeParams[0];
      if (keyType === undefined || typeof keyType === "string") {
        throw new Error(
          "Price Table not found, contract may not be initialized",
        );
      }
      this.priceTableInfo = {
        fieldType: keyType.address,
        id: tableId,
      };
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
}
