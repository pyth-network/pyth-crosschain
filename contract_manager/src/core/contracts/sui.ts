/** biome-ignore-all lint/suspicious/useAwait: pre-existing in this file */
/** biome-ignore-all lint/suspicious/noExplicitAny: pre-existing in this file */
/** biome-ignore-all lint/style/noNonNullAssertion: pre-existing in this file */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */
import { parseVaa } from "@certusone/wormhole-sdk";
import { uint8ArrayToBCS } from "@certusone/wormhole-sdk/lib/cjs/sui";
import { bcs } from "@mysten/sui/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { getStructFields, SuiPythClient } from "@pythnetwork/pyth-sui-js";
import type { DataSource } from "@pythnetwork/xc-admin-common";
import {
  decodeGovernancePayload,
  UpdateTrustedSigner264Bit,
  UpgradeSuiLazerContract,
} from "@pythnetwork/xc-admin-common";
import type { Vault } from "../../node/utils/governance";
import { SubmittedWormholeMessage } from "../../node/utils/governance";
import { sleep } from "../../utils/sleep";
import type { DeploymentType, PrivateKey, TxResult } from "../base";
import { PriceFeedContract, Storable, toDeploymentType } from "../base";
import type { Chain, MoveLazerMeta } from "../chains";
import { SuiChain } from "../chains";
import { WormholeContract } from "./wormhole";

type ObjectId = string;

/**
 * A Move `vector<u8>` field rendered into the object's JSON comes back as a
 * `number[]` over JSON-RPC but as a base64-encoded `string` over gRPC (the
 * `.json` shape is explicitly transport-dependent per `@mysten/sui`). Normalise
 * both representations to a `Buffer`.
 */
function bytesFromMoveField(data: number[] | string): Buffer {
  return typeof data === "string"
    ? Buffer.from(data, "base64")
    : Buffer.from(data);
}

export class SuiPriceFeedContract extends PriceFeedContract {
  static type = "SuiPriceFeedContract";
  private client: SuiPythClient;

  /**
   * Given the ids of the pyth state and wormhole state, create a new SuiPriceFeedContract
   * The package ids are derived based on the state ids
   *
   * @param chain - the chain which this contract is deployed on
   * @param stateId - id of the pyth state for the deployed contract
   * @param wormholeStateId - id of the wormhole state for the wormhole contract that pyth binds to
   */
  constructor(
    public chain: SuiChain,
    public stateId: string,
    public wormholeStateId: string,
    public deploymentType: DeploymentType,
  ) {
    super();
    this.client = new SuiPythClient(
      this.getProvider(),
      this.stateId,
      this.wormholeStateId,
    );
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      stateId: string;
      wormholeStateId: string;
      deploymentType: string;
    },
  ): SuiPriceFeedContract {
    if (parsed.type !== SuiPriceFeedContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof SuiChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new SuiPriceFeedContract(
      chain,
      parsed.stateId,
      parsed.wormholeStateId,
      toDeploymentType(parsed.deploymentType),
    );
  }

  getType(): string {
    return SuiPriceFeedContract.type;
  }

  getChain(): SuiChain {
    return this.chain;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      deploymentType: this.deploymentType,
      stateId: this.stateId,
      type: SuiPriceFeedContract.type,
      wormholeStateId: this.wormholeStateId,
    };
  }

  /**
   * Given a objectId, returns the id for the package that the object belongs to.
   * @param objectId - the object id to get
   */
  async getPackageId(objectId: ObjectId): Promise<ObjectId> {
    return this.client.getPackageId(objectId);
  }

  async getPythPackageId(): Promise<ObjectId> {
    return await this.getPackageId(this.stateId);
  }

  async getWormholePackageId(): Promise<ObjectId> {
    return await this.getPackageId(this.wormholeStateId);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.stateId}`;
  }

  private parsePrice(priceInfo: unknown) {
    const fields = getStructFields(priceInfo);
    const expoFields = getStructFields(fields.expo);
    let expo = expoFields.magnitude as string;
    if (expoFields.negative) expo = "-" + expo;
    const priceFields = getStructFields(fields.price);
    let price = priceFields.magnitude as string;
    if (priceFields.negative) price = "-" + price;
    return {
      conf: fields.conf as string,
      expo,
      price,
      publishTime: fields.timestamp as string,
    };
  }

  async getPriceFeed(feedId: string) {
    const provider = this.getProvider();
    const priceInfoObjectId = await this.client.getPriceFeedObjectId(feedId);
    if (!priceInfoObjectId) return;
    const { object } = await provider.core.getObject({
      include: { json: true },
      objectId: priceInfoObjectId,
    });
    if (!object.json) {
      throw new Error(
        `Price feed ID ${priceInfoObjectId} in price table but object not found!!`,
      );
    }
    const priceFeed = getStructFields(
      getStructFields(object.json.price_info).price_feed,
    );
    return {
      emaPrice: this.parsePrice(priceFeed.ema_price),
      price: this.parsePrice(priceFeed.price),
    };
  }

  /**
   * Given a signed VAA, execute the migration instruction on the pyth contract.
   * The payload of the VAA can be obtained from the `getUpgradePackagePayload` method.
   * @param vaa - the vaa payload
   * @param keypair - used to sign the transaction
   */
  async executeMigrateInstruction(vaa: Buffer, keypair: Ed25519Keypair) {
    const tx = new Transaction();
    const packageId = await this.getPythPackageId();
    const verificationReceipt = await this.getVaaVerificationReceipt(
      tx,
      packageId,
      vaa,
    );

    tx.moveCall({
      arguments: [tx.object(this.stateId), verificationReceipt!],
      target: `${packageId}::migrate::migrate`,
    });

    return this.executeTransaction(tx, keypair);
  }

  async executeUpdatePriceFeed(): Promise<TxResult> {
    // We need the feed ids to be able to execute the transaction
    // it may be possible to get them from the VAA but in batch transactions,
    // it is also possible to hava fewer feeds that user wants to update compared to
    // what exists in the VAA.
    throw new Error("Use executeUpdatePriceFeedWithFeeds instead");
  }

  async executeUpdatePriceFeedWithFeeds(
    senderPrivateKey: string,
    vaas: Buffer[],
    feedIds: string[],
  ): Promise<TxResult> {
    const tx = new Transaction();
    await this.client.updatePriceFeeds(tx, vaas, feedIds);
    const keypair = Ed25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
    );
    const result = await this.executeTransaction(tx, keypair);
    return { id: result.digest, info: result };
  }
  async executeCreatePriceFeed(
    senderPrivateKey: string,
    vaas: Buffer[],
  ): Promise<TxResult> {
    const tx = new Transaction();
    await this.client.createPriceFeed(tx, vaas);
    const keypair = Ed25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
    );

    const result = await this.executeTransaction(tx, keypair);
    return { id: result.digest, info: result };
  }

  async executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const keypair = Ed25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
    );
    const tx = new Transaction();
    const packageId = await this.getPythPackageId();
    const verificationReceipt = await this.getVaaVerificationReceipt(
      tx,
      packageId,
      vaa,
    );

    tx.moveCall({
      arguments: [tx.object(this.stateId), verificationReceipt!],
      target: `${packageId}::governance::execute_governance_instruction`,
    });

    const result = await this.executeTransaction(tx, keypair);
    return { id: result.digest, info: result };
  }

  async executeUpgradeInstruction(
    vaa: Buffer,
    keypair: Ed25519Keypair,
    modules: number[][],
    dependencies: string[],
  ) {
    const tx = new Transaction();
    const packageId = await this.getPythPackageId();
    const verificationReceipt = await this.getVaaVerificationReceipt(
      tx,
      packageId,
      vaa,
    );

    const [upgradeTicket] = tx.moveCall({
      arguments: [tx.object(this.stateId), verificationReceipt!],
      target: `${packageId}::contract_upgrade::authorize_upgrade`,
    });

    const [upgradeReceipt] = tx.upgrade({
      dependencies,
      modules,
      package: packageId,
      ticket: upgradeTicket!,
    });

    tx.moveCall({
      arguments: [tx.object(this.stateId), upgradeReceipt!],
      target: `${packageId}::contract_upgrade::commit_upgrade`,
    });
    const result = await this.executeTransaction(tx, keypair);
    return { id: result.digest, info: result };
  }

  /**
   * Utility function to get the verification receipt object for a VAA that can be
   * used to authorize a governance instruction.
   * @param tx - the transaction
   * @param packageId - pyth package id
   * @param vaa - the vaa payload
   */
  async getVaaVerificationReceipt(
    tx: Transaction,
    packageId: string,
    vaa: Buffer,
  ) {
    const wormholePackageId = await this.getWormholePackageId();

    const [verifiedVAA] = tx.moveCall({
      arguments: [
        tx.object(this.wormholeStateId),
        tx.pure.arguments([...vaa]),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
      target: `${wormholePackageId}::vaa::parse_and_verify`,
    });

    const [verificationReceipt] = tx.moveCall({
      arguments: [tx.object(this.stateId), verifiedVAA!],
      target: `${packageId}::governance::verify_vaa`,
    });
    return verificationReceipt;
  }

  /**
   * Given a transaction block and a keypair, sign and execute it
   * Sets the gas budget to 2x the estimated gas cost
   * @param tx - the transaction
   * @param keypair - the keypair
   */
  private executeTransaction(tx: Transaction, keypair: Ed25519Keypair) {
    return this.chain.executeTransaction(tx, keypair);
  }

  async getValidTimePeriod() {
    const fields = await this.getStateFields();
    return Number(fields.stale_price_threshold);
  }

  async getDataSources(): Promise<DataSource[]> {
    const provider = this.getProvider();
    // `data_sources` is a plain dynamic field (a `Set<DataSource>` stored
    // inline), not a dynamic *object* field, so resolve the field wrapper id
    // and load it. `getDynamicObjectField` derives a different child id and
    // fails ("object does not exist") on both JSON-RPC and gRPC.
    const { dynamicField } = await provider.core.getDynamicField({
      name: {
        bcs: bcs
          .vector(bcs.u8())
          .serialize(Array.from(Buffer.from("data_sources", "utf8")))
          .toBytes(),
        type: "vector<u8>",
      },
      parentId: this.stateId,
    });
    const { object } = await provider.core.getObject({
      include: { json: true },
      objectId: dynamicField.fieldId,
    });
    if (!object.json) {
      throw new Error(
        "Data Sources not found, contract may not be initialized",
      );
    }
    const keys = getStructFields(getStructFields(object.json).value)
      .keys as unknown[];
    return keys.map((key) => {
      const fields = getStructFields(key);
      const data = getStructFields(
        getStructFields(fields.emitter_address).value,
      ).data as number[] | string;
      return {
        emitterAddress: bytesFromMoveField(data).toString("hex"),
        emitterChain: Number(fields.emitter_chain),
      };
    });
  }

  async getGovernanceDataSource(): Promise<DataSource> {
    const fields = await this.getStateFields();
    const governanceFields = getStructFields(fields.governance_data_source);
    const emitterAddress = getStructFields(
      getStructFields(governanceFields.emitter_address).value,
    ).data as number[] | string;
    return {
      emitterAddress: bytesFromMoveField(emitterAddress).toString("hex"),
      emitterChain: Number(governanceFields.emitter_chain),
    };
  }

  async getBaseUpdateFee() {
    const fields = await this.getStateFields();
    return { amount: fields.base_update_fee as string };
  }

  async getLastExecutedGovernanceSequence() {
    const fields = await this.getStateFields();
    return Number(fields.last_executed_governance_sequence);
  }

  getProvider() {
    return this.chain.getProvider();
  }

  private async getStateFields(): Promise<Record<string, unknown>> {
    const provider = this.getProvider();
    const { object } = await provider.core.getObject({
      include: { json: true },
      objectId: this.stateId,
    });
    if (!object.json) throw new Error("Unable to fetch pyth state object");
    return getStructFields(object.json);
  }

  /**
   * The package that *defines* the contract's Move types, which is the package the state
   * object's own type tag names. Sui upgrades publish a new package id but leave type tags
   * pointing at the original, so this is the id that `PriceFeedUpdateEvent` is emitted under —
   * filtering on the current (upgraded) package id silently matches nothing.
   */
  async getOriginalPackageId(): Promise<ObjectId> {
    const { object } = await suiGraphqlQuery<{
      object: { asMoveObject: { contents: { type: { repr: string } } } } | null;
    }>(
      this.chain,
      `{ object(address: "${this.stateId}") { asMoveObject { contents { type { repr } } } } }`,
    );
    if (object === null) {
      throw new Error(`Sui state object ${this.stateId} not found`);
    }
    const [packageId] = object.asMoveObject.contents.type.repr.split("::");
    if (packageId === undefined) {
      throw new Error(`Unparseable state object type on ${this.stateId}`);
    }
    return packageId;
  }

  /**
   * Yields `PriceFeedUpdateEvent` counts per feed id for successive checkpoint sub-ranges of
   * `[fromCheckpoint, toCheckpoint]`, covering the range in order and without gaps.
   *
   * The Sui event carries the same meaning as the EVM `PriceFeedUpdate` log: `update_cache`
   * emits it only inside its `is_fresh_update` branch, so both count accepted writes.
   * @param options - checkpoint range to scan plus request-shaping knobs
   */
  async *streamPriceFeedUpdateCounts(
    options: SuiPriceFeedUpdateScanOptions,
  ): AsyncGenerator<SuiPriceFeedUpdateBatch> {
    const { chunkSize = 2000, fromCheckpoint, onRetry, toCheckpoint } = options;
    const eventType = `${await this.getOriginalPackageId()}::event::PriceFeedUpdateEvent`;

    for (let cursor = fromCheckpoint; cursor <= toCheckpoint; ) {
      const chunkEnd = Math.min(cursor + chunkSize - 1, toCheckpoint);
      const counts = new Map<string, number>();
      // `afterCheckpoint` / `beforeCheckpoint` are exclusive, so widen by one on each side.
      const bounds =
        (cursor > 0 ? `afterCheckpoint: ${cursor - 1}, ` : "") +
        `beforeCheckpoint: ${chunkEnd + 1}`;
      let after: string | undefined;
      do {
        const page = await suiGraphqlQuery<{
          events: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: { contents: { json: SuiPriceFeedUpdateJson } }[];
          };
        }>(
          this.chain,
          `{ events(filter: { type: "${eventType}", ${bounds} }, first: ${SUI_EVENTS_PAGE_SIZE}${
            after === undefined ? "" : `, after: "${after}"`
          }) { pageInfo { hasNextPage endCursor } nodes { contents { json } } } }`,
          onRetry,
        );
        for (const node of page.events.nodes) {
          const feedId = Buffer.from(
            node.contents.json.price_feed.price_identifier.bytes,
            "base64",
          ).toString("hex");
          counts.set(feedId, (counts.get(feedId) ?? 0) + 1);
        }
        after = page.events.pageInfo.hasNextPage
          ? (page.events.pageInfo.endCursor ?? undefined)
          : undefined;
      } while (after !== undefined);

      yield { counts, fromCheckpoint: cursor, toCheckpoint: chunkEnd };
      cursor = chunkEnd + 1;
    }
  }
}

/** Page cap the public GraphQL service enforces on `events` (`serviceConfig.maxPageSize`). */
const SUI_EVENTS_PAGE_SIZE = 50;

/** Number of `PriceFeedUpdateEvent`s keyed by 64-char hex feed id, without the `0x` prefix. */
export type SuiPriceFeedUpdateCounts = Map<string, number>;

export type SuiPriceFeedUpdateBatch = {
  fromCheckpoint: number;
  toCheckpoint: number;
  counts: SuiPriceFeedUpdateCounts;
};

export type SuiPriceFeedUpdateScanOptions = {
  fromCheckpoint: number;
  toCheckpoint: number;
  /** Checkpoints covered by a single filter window; each is paged 50 events at a time. */
  chunkSize?: number;
  onRetry?: (message: string) => void;
};

type SuiPriceFeedUpdateJson = {
  price_feed: { price_identifier: { bytes: string } };
};

/**
 * Sui JSON-RPC was retired on public fullnodes in favour of GraphQL and gRPC, and the
 * `@mysten/sui` gRPC surface has no historical event query, so the scan talks GraphQL
 * directly. The endpoint is derived from the chain rather than stored, since the chain
 * store's `rpcUrl` is the (now method-less) JSON-RPC host.
 */
export function suiGraphqlEndpoint(chain: SuiChain): string {
  if (chain.graphqlUrl !== undefined) return chain.graphqlUrl;
  return chain.isMainnet()
    ? "https://graphql.mainnet.sui.io/graphql"
    : "https://graphql.testnet.sui.io/graphql";
}

async function suiGraphqlQuery<T>(
  chain: SuiChain,
  query: string,
  onRetry?: (message: string) => void,
): Promise<T> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(suiGraphqlEndpoint(chain), {
        body: JSON.stringify({ query }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const body = (await response.json()) as {
        data?: T;
        errors?: { message: string }[];
      };
      if (body.errors !== undefined && body.errors.length > 0) {
        throw new Error(body.errors.map((e) => e.message).join("; "));
      }
      if (body.data === undefined) throw new Error("empty GraphQL response");
      return body.data;
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) throw error;
      const backoffMs = 500 * 2 ** (attempt - 1);
      onRetry?.(
        `GraphQL attempt ${attempt} failed, retrying in ${backoffMs}ms: ${error}`,
      );
      await sleep(backoffMs);
    }
  }
}

/** Sequence number and unix timestamp of the newest checkpoint the endpoint has. */
export async function getLatestSuiCheckpoint(chain: SuiChain) {
  const { checkpoint } = await suiGraphqlQuery<{
    checkpoint: { sequenceNumber: number; timestamp: string };
  }>(chain, "{ checkpoint { sequenceNumber timestamp } }");
  return {
    sequenceNumber: Number(checkpoint.sequenceNumber),
    timestamp: Math.floor(Date.parse(checkpoint.timestamp) / 1000),
  };
}

export async function getSuiCheckpointTimestamp(
  chain: SuiChain,
  sequenceNumber: number,
): Promise<number | undefined> {
  const { checkpoint } = await suiGraphqlQuery<{
    checkpoint: { timestamp: string } | null;
  }>(chain, `{ checkpoint(sequenceNumber: ${sequenceNumber}) { timestamp } }`);
  return checkpoint === null
    ? undefined
    : Math.floor(Date.parse(checkpoint.timestamp) / 1000);
}

/**
 * Lowest checkpoint whose timestamp is at or after `unixTimestamp`, by binary search — the
 * GraphQL service has no timestamp filter on checkpoints. Pruned checkpoints read as
 * `undefined` and are treated as "older than the target", which walks the search up into the
 * retained range instead of failing.
 */
export async function getSuiCheckpointAtTimestamp(
  chain: SuiChain,
  unixTimestamp: number,
): Promise<number> {
  const latest = await getLatestSuiCheckpoint(chain);
  if (unixTimestamp >= latest.timestamp) return latest.sequenceNumber;
  let low = 0;
  let high = latest.sequenceNumber;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const timestamp = await getSuiCheckpointTimestamp(chain, mid);
    if (timestamp !== undefined && timestamp >= unixTimestamp) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

export class SuiWormholeContract extends WormholeContract {
  public static type = "SuiWormholeContract";
  private client: SuiPythClient;

  getId(): string {
    return `${this.chain.getId()}_${this.stateId}`;
  }

  getType(): string {
    return SuiWormholeContract.type;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      deploymentType: this.deploymentType,
      stateId: this.stateId,
      type: SuiWormholeContract.type,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: {
      type: string;
      stateId: string;
      deploymentType: string;
    },
  ): SuiWormholeContract {
    if (parsed.type !== SuiWormholeContract.type)
      throw new Error("Invalid type");
    if (!(chain instanceof SuiChain))
      throw new Error(`Wrong chain type ${chain}`);
    return new SuiWormholeContract(
      chain,
      parsed.stateId,
      toDeploymentType(parsed.deploymentType),
    );
  }

  constructor(
    public chain: SuiChain,
    public stateId: string,
    public deploymentType: DeploymentType,
  ) {
    super();
    this.client = new SuiPythClient(
      this.chain.getProvider(),
      // HACK:
      // We're using the SuiPythClient to work with the Wormhole contract
      // so there is no Pyth contract here, passing empty string to type-
      // check.
      "",
      this.stateId,
    );
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const data = await this.getStateFields();
    return Number(data.guardian_set_index);
  }

  // There doesn't seem to be a way to get a value out of any function call
  // via a Sui transaction due to the linear nature of the language, this is
  // enforced at the TransactionBlock level by only allowing you to receive
  // receipts.
  async getChainId(): Promise<number> {
    return this.chain.getWormholeChainId();
  }

  // NOTE: There's no way to getChain() on the main interface, should update
  // that interface.
  public getChain(): SuiChain {
    return this.chain;
  }

  async getGuardianSet(): Promise<string[]> {
    const data = await this.getStateFields();
    const guardian_sets = data.guardian_sets;
    return guardian_sets;
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const tx = new Transaction();
    const coreObjectId = this.stateId;
    const corePackageId = await this.client.getWormholePackageId();
    const [verifiedVaa] = tx.moveCall({
      arguments: [
        tx.object(coreObjectId),
        tx.pure(uint8ArrayToBCS(new Uint8Array(vaa))),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
      target: `${corePackageId}::vaa::parse_and_verify`,
    });

    const [decreeTicket] = tx.moveCall({
      arguments: [tx.object(coreObjectId)],
      target: `${corePackageId}::update_guardian_set::authorize_governance`,
    });

    const [decreeReceipt] = tx.moveCall({
      arguments: [tx.object(coreObjectId), verifiedVaa!, decreeTicket!],
      target: `${corePackageId}::governance_message::verify_vaa`,
      typeArguments: [
        `${corePackageId}::update_guardian_set::GovernanceWitness`,
      ],
    });

    tx.moveCall({
      arguments: [
        tx.object(coreObjectId),
        decreeReceipt!,
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
      target: `${corePackageId}::update_guardian_set::update_guardian_set`,
    });

    const keypair = Ed25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
    );
    const result = await this.executeTransaction(tx, keypair);
    return { id: result.digest, info: result };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getStateFields(): Promise<any> {
    const provider = this.chain.getProvider();
    const { object } = await provider.core.getObject({
      include: { json: true },
      objectId: this.stateId,
    });
    if (!object.json) throw new Error("Unable to fetch pyth state object");
    return getStructFields(object.json);
  }

  /**
   * Given a transaction block and a keypair, sign and execute it
   * Sets the gas budget to 2x the estimated gas cost
   * @param tx - the transaction
   * @param keypair - the keypair
   */
  private executeTransaction(tx: Transaction, keypair: Ed25519Keypair) {
    return this.chain.executeTransaction(tx, keypair);
  }
}

export class SuiLazerContract extends Storable {
  static type = "SuiLazerContract";

  constructor(
    public readonly chain: SuiChain,
    public readonly stateId: string,
    public readonly wormholeStateId: string,
  ) {
    super();
  }

  getId(): string {
    return `${this.chain.getId()}_${this.stateId}`;
  }

  getType(): string {
    return SuiLazerContract.type;
  }

  toJson() {
    return {
      chain: this.chain.getId(),
      stateId: this.stateId,
      type: SuiLazerContract.type,
      wormholeStateId: this.wormholeStateId,
    };
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; stateId: string; wormholeStateId: string },
  ): SuiLazerContract {
    if (parsed.type !== SuiLazerContract.type) {
      throw new Error("Invalid type");
    }
    return new SuiLazerContract(
      chain as SuiChain,
      parsed.stateId,
      parsed.wormholeStateId,
    );
  }

  async executeGovernanceProposals(
    signer: Ed25519Keypair,
    chain: SuiChain,
    vault: Vault,
    packagePath: string,
    since?: number,
    // support overriding outside of CLI
    console_: Pick<Console, "info" | "warn"> = console,
  ) {
    const client = chain.getProvider();
    const emitterKey = await vault.getEmitter();

    if (since === undefined) {
      console_.info("Fetching last seen sequence ID...");

      const { seen_sequence } = await chain.getStateGovernanceInfo(
        client,
        this.stateId,
      );

      if (seen_sequence >= BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("'seen_sequence' bigger than JS integer");
      }

      since = Number(seen_sequence + 1n);
    }

    for (let i = since; ; i++) {
      const vaaRef = new SubmittedWormholeMessage(emitterKey, i, vault.cluster);
      let vaa: Uint8Array;
      try {
        vaa = await vaaRef.fetchVaa();
      } catch {
        console_.warn(`Could not find VAA #${i.toString()}, ending.`);
        break;
      }
      const action = decodeGovernancePayload(parseVaa(vaa).payload);
      if (!action) {
        console_.warn(
          `Could not parse VAA #${i.toString()} action, skipping...`,
        );
        continue;
      }

      if (action.targetChainId !== chain.wormholeChainName) {
        console_.warn(
          `Expected chain '${chain.wormholeChainName}',`,
          `VAA #${i.toString()} targets '${action.targetChainId}', skipping... `,
        );
        continue;
      }
      if (action instanceof UpgradeSuiLazerContract) {
        console_.info(
          `Attempting contract upgrade to version ${action.version.toString()}...`,
        );
        console_.info("  (will fail if not on correct source version)");
        const meta = await this.fetchAndBumpMeta(chain, packagePath);
        const pkg = await chain.buildPackage(packagePath);
        const digest = await chain.upgradeLazerContract({
          meta,
          pkg,
          signer,
          stateId: this.stateId,
          vaa,
          wormholeStateId: this.wormholeStateId,
        });
        console_.info(
          `  Transaction finished: ${chain.explorerUrl("txblock", digest)}`,
        );
      } else if (action instanceof UpdateTrustedSigner264Bit) {
        console_.info(`Updating trusted signer ${action.publicKey}...`);
        const digest = await chain.updateTrustedSigner({
          signer,
          stateId: this.stateId,
          vaa,
          wormholeStateId: this.wormholeStateId,
        });
        console_.info(
          `  Transaction finished: ${chain.explorerUrl("txblock", digest)}`,
        );
      } else {
        console_.warn(
          `Unknown governance action in VAA #${i.toString()}, skipping...`,
        );
      }
    }
  }

  /**
   * Read the current set of trusted Lazer signers from the shared `State`
   * object. The `trusted_signers: vector<TrustedSignerInfo>` field is stored
   * inline on the state, so a single object fetch enumerates every signer.
   *
   * @returns one entry per signer: `publicKey` (33-byte compressed secp256k1,
   *   hex without 0x) and `expiresAt` (unix seconds)
   */
  async getTrustedSigners(): Promise<
    { publicKey: string; expiresAt: bigint }[]
  > {
    const provider = this.chain.getProvider();
    const { object } = await provider.core.getObject({
      include: { json: true },
      objectId: this.stateId,
    });
    if (!object.json) {
      throw new Error("Unable to fetch Lazer state object");
    }
    const signers = getStructFields(object.json).trusted_signers as unknown[];
    return signers.map((signer) => {
      const fields = getStructFields(signer);
      const publicKey = fields.public_key as number[] | string;
      return {
        expiresAt: BigInt(fields.expires_at as string | number),
        publicKey: bytesFromMoveField(publicKey).toString("hex"),
      };
    });
  }

  /**
   * Bumps contract version in source based on on-chain version and returns new
   * contract metadata.
   */
  async fetchAndBumpMeta(
    chain: SuiChain,
    packagePath: string,
  ): Promise<MoveLazerMeta> {
    const { version } = await chain.getStatePackageInfo(
      chain.getProvider(),
      this.stateId,
    );
    const meta = {
      receiver_chain_id: chain.getWormholeChainId(),
      version: (BigInt(version) + 1n).toString(),
    };
    await chain.updateLazerMeta(packagePath, meta);
    return meta;
  }
}
