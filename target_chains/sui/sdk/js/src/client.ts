/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-console */
import { Buffer } from "node:buffer";

import { bcs } from "@mysten/sui/bcs";
import type { ClientWithCoreApi } from "@mysten/sui/client";
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
    public provider: ClientWithCoreApi,
    public pythStateId: ObjectId,
    public wormholeStateId: ObjectId,
  ) {
    this.pythPackageId = undefined;
    this.wormholePackageId = undefined;
  }

  async getBaseUpdateFee(): Promise<number> {
    if (this.baseUpdateFee === undefined) {
      const result = await this.provider.core.getObject({
        objectId: this.pythStateId,
        include: { json: true },
      });
      const json = result.object.json as Record<string, unknown> | null;
      if (!json)
        throw new Error("Unable to fetch pyth state object");
      this.baseUpdateFee = Number(json.base_update_fee);
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
    const result = await this.provider.core.getObject({
      objectId,
      include: { json: true },
    });
    const json = result.object.json as Record<string, unknown> | null;
    if (!json) {
      throw new Error(`Cannot fetch package id for object ${objectId}`);
    }

    if ("upgrade_cap" in json) {
      const upgradeCap = json.upgrade_cap as Record<string, unknown>;
      // JSON-RPC wraps nested objects in { type, fields }, gRPC may not.
      const fields = (upgradeCap.fields ?? upgradeCap) as Record<
        string,
        unknown
      >;
      return fields.package as string;
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
    const vaa = this.extractVaaBytesFromAccumulatorMessage(updates[0]!);
    const verifiedVaas = await this.verifyVaas([vaa], tx);
    const [priceUpdatesHotPotato] = tx.moveCall({
      target: `${packageId}::pyth::create_authenticated_price_infos_using_accumulator`,
      arguments: [
        tx.object(this.pythStateId),
        tx.pure(
          bcs
            .vector(bcs.U8)
            .serialize([...updates[0]!], {
              maxSize: MAX_ARGUMENT_SIZE,
            })
            .toBytes(),
        ),
        verifiedVaas[0]!,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });
    return priceUpdatesHotPotato!;
  }

  async executePriceFeedUpdates(
    tx: Transaction,
    packageId: string,
    feedIds: HexString[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        target: `${packageId}::pyth::update_single_price_feed`,
        arguments: [
          tx.object(this.pythStateId),
          priceUpdatesHotPotato,
          tx.object(priceInfoObjectId),
          coins[coinId],
          tx.object(SUI_CLOCK_OBJECT_ID),
        ],
      });
      coinId++;
    }
    tx.moveCall({
      target: `${packageId}::hot_potato_vector::destroy`,
      arguments: [priceUpdatesHotPotato],
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
    const vaa = this.extractVaaBytesFromAccumulatorMessage(updates[0]!);
    const verifiedVaas = await this.verifyVaas([vaa], tx);
    tx.moveCall({
      target: `${packageId}::pyth::create_price_feeds_using_accumulator`,
      arguments: [
        tx.object(this.pythStateId),
        tx.pure(
          bcs
            .vector(bcs.U8)
            .serialize([...updates[0]!], {
              maxSize: MAX_ARGUMENT_SIZE,
            })
            .toBytes(),
        ),
        verifiedVaas[0]!,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
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
      // BCS-encode the PriceIdentifier struct name.
      // PriceIdentifier has a single field `bytes: vector<u8>`, so its BCS
      // encoding is the same as just encoding the inner vector<u8>.
      const nameBcs = bcs
        .vector(bcs.U8)
        .serialize([...Buffer.from(normalizedFeedId, "hex")])
        .toBytes();
      try {
        const result = await this.provider.core.getDynamicObjectField({
          parentId: tableId,
          name: {
            type: `${fieldType}::price_identifier::PriceIdentifier`,
            bcs: nameBcs,
          },
          include: { json: true },
        });
        const json = result.object.json as Record<string, unknown> | null;
        if (!json) {
          return undefined;
        }
        this.priceFeedObjectIdCache.set(
          normalizedFeedId,
          json.value as string,
        );
      } catch (e: unknown) {
        // Only treat "not found" errors as missing feed; re-throw others
        // (e.g. network timeouts, auth failures) so callers see real outages.
        const msg = e instanceof Error ? e.message : String(e);
        if (
          msg.includes("Could not find the referenced object") ||
          msg.includes("dynamicFieldNotFound") ||
          msg.includes("not found")
        ) {
          return undefined;
        }
        throw e;
      }
    }
    return this.priceFeedObjectIdCache.get(normalizedFeedId);
  }

  /**
   * Fetches the price table object id for the current state id if not cached
   * @returns price table object id
   */
  async getPriceTableInfo(): Promise<{ id: ObjectId; fieldType: ObjectId }> {
    if (this.priceTableInfo === undefined) {
      // BCS-encode the "price_info" name as vector<u8>
      const nameBcs = bcs
        .vector(bcs.U8)
        .serialize([...Buffer.from("price_info")])
        .toBytes();
      const result = await this.provider.core.getDynamicObjectField({
        parentId: this.pythStateId,
        name: {
          type: "vector<u8>",
          bcs: nameBcs,
        },
      });
      if (!result.object.type) {
        throw new Error(
          "Price Table not found, contract may not be initialized",
        );
      }
      let type = result.object.type.replace("0x2::table::Table<", "");
      type = type.replace(
        "::price_identifier::PriceIdentifier, 0x2::object::ID>",
        "",
      );
      this.priceTableInfo = { id: result.object.objectId, fieldType: type };
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
