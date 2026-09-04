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

/** A guardian key is a 20-byte ETH-style address. */
const GUARDIAN_KEY_LENGTH = 20;

/** Sui caps a single pure argument at 16 KiB; a VAA is far below it, but be explicit. */
const MAX_PURE_ARGUMENT_SIZE = 16 * 1024;

/**
 * Read the object id out of a Move field holding a `UID`-bearing struct (a `Table`, a `Bag`).
 * gRPC flattens it to `{ id: "0x…" }` while JSON-RPC nests it as `{ fields: { id: { id: "0x…" } } }`.
 */
function objectIdFromMoveField(value: unknown): ObjectId {
  const fields = getStructFields(value);
  const id = fields.id;
  if (typeof id === "string") return id;
  const inner = getStructFields(id).id;
  if (typeof inner === "string") return inner;
  throw new Error(`Move field carries no object id: ${JSON.stringify(value)}`);
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

  /**
   * The current guardian set's keys, as 0x-prefixed lowercase 20-byte hex, in index order.
   *
   * Wormhole's Sui `State` does not hold the keys inline: `guardian_sets` is a
   * `Table<u32, GuardianSet>`, so the object JSON only carries the table's id and size. The
   * current set lives in the dynamic field of that table whose `u32` key is
   * `state.guardian_set_index`, and each `Guardian` wraps a `Bytes20 { data: vector<u8> }`.
   */
  async getGuardianSet(): Promise<string[]> {
    const state = await this.getStateFields();
    const index = Number(state.guardian_set_index);
    const tableId = objectIdFromMoveField(state.guardian_sets);

    const provider = this.chain.getProvider();
    // A `Table` entry is a plain dynamic field keyed by the set index, not a dynamic *object*
    // field; `getDynamicObjectField` derives a different child id and would not resolve.
    const { dynamicField } = await provider.core.getDynamicField({
      name: { bcs: bcs.u32().serialize(index).toBytes(), type: "u32" },
      parentId: tableId,
    });
    const { object } = await provider.core.getObject({
      include: { json: true },
      objectId: dynamicField.fieldId,
    });
    if (!object.json) {
      throw new Error(
        `guardian set ${index} is not present in table ${tableId} of wormhole state ${this.stateId}`,
      );
    }

    const guardianSet = getStructFields(getStructFields(object.json).value);
    if (Number(guardianSet.index) !== index) {
      throw new Error(
        `guardian set table entry ${index} reports index ${guardianSet.index}`,
      );
    }
    const guardians = guardianSet.guardians;
    if (!Array.isArray(guardians)) {
      throw new Error(
        `guardian set ${index} has no guardians vector; got ${typeof guardians}`,
      );
    }
    return guardians.map((guardian: unknown, position: number) => {
      const pubkey = getStructFields(getStructFields(guardian).pubkey);
      const key = bytesFromMoveField(pubkey.data as number[] | string);
      if (key.length !== GUARDIAN_KEY_LENGTH) {
        throw new Error(
          `guardian ${position} of set ${index} is ${key.length} bytes, expected ${GUARDIAN_KEY_LENGTH}`,
        );
      }
      return `0x${key.toString("hex")}`;
    });
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const tx = await this.buildGuardianSetUpgrade(vaa);
    const keypair = Ed25519Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(senderPrivateKey, "hex")),
    );
    const result = await this.executeTransaction(tx, keypair);
    return { id: result.digest, info: result };
  }

  /**
   * Build the guardian-set-upgrade PTB without sending it, so it can be simulated.
   *
   * The four calls are Wormhole's governance decree flow: the VAA is parsed and its signatures
   * checked against the current set, `authorize_governance` mints the ticket that names this
   * decree, `verify_vaa` turns the VAA plus the ticket into a receipt, and `update_guardian_set`
   * consumes the receipt to install the new set.
   */
  async buildGuardianSetUpgrade(vaa: Buffer): Promise<Transaction> {
    const tx = new Transaction();
    const coreObjectId = this.stateId;
    const corePackageId = await this.client.getWormholePackageId();
    const [verifiedVaa] = tx.moveCall({
      arguments: [
        tx.object(coreObjectId),
        tx.pure(
          bcs
            .vector(bcs.u8())
            .serialize(Array.from(vaa), { maxSize: MAX_PURE_ARGUMENT_SIZE })
            .toBytes(),
        ),
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

    return tx;
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
