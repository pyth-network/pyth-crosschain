import { createHash } from "node:crypto";

import type { DataSource } from "@pythnetwork/xc-admin-common";
import {
  getProgramDataAddress,
  getUpgradeInstruction,
} from "@pythnetwork/xc-admin-common";
import type { AccountInfo, TransactionInstruction } from "@solana/web3.js";
import {
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";

import type { KeyValueConfig } from "../base";
import { Storable } from "../base";
import type { Chain } from "../chains";
import { SvmChain } from "../chains";

/**
 * Sequential reader for the borsh encodings the on-chain accounts use. Anchor's
 * `Program` client would do this for us, but the published receiver and core
 * bridge IDLs are in the pre-0.30 format that this package's Anchor can no
 * longer instantiate, and the core bridge's legacy accounts have no IDL at all.
 */
class BorshReader {
  private offset = 0;

  constructor(private readonly data: Buffer) {}

  skip(bytes: number): void {
    this.offset += bytes;
  }

  u8(): number {
    const value = this.data.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  u16(): number {
    const value = this.data.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  u32(): number {
    const value = this.data.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  u64(): bigint {
    const value = this.data.readBigUInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  bytes(length: number): Buffer {
    const value = this.data.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  pubkey(): PublicKey {
    return new PublicKey(this.bytes(32));
  }

  option<T>(read: () => T): T | undefined {
    return this.u8() === 0 ? undefined : read();
  }

  vec<T>(read: () => T): T[] {
    return Array.from({ length: this.u32() }, read);
  }
}

/** The first 8 bytes of `sha256("<namespace>:<name>")`, as Anchor derives them. */
function discriminator(namespace: string, name: string): Buffer {
  return createHash("sha256")
    .update(`${namespace}:${name}`)
    .digest()
    .subarray(0, 8);
}

/**
 * The key the BPF upgradeable loader lets upgrade `programId`, or `undefined` if the program has
 * been made immutable.
 */
export async function getUpgradeAuthority(
  chain: SvmChain,
  programId: PublicKey,
): Promise<PublicKey | undefined> {
  const account = await chain
    .getConnection()
    .getAccountInfo(getProgramDataAddress(programId));
  if (!account) {
    throw new Error(
      `${chain.getId()}: ${programId.toBase58()} has no program data account — is it deployed with the upgradeable loader?`,
    );
  }
  const reader = new BorshReader(account.data);
  reader.skip(4 + 8); // UpgradeableLoaderState::ProgramData discriminant, deployment slot
  return reader.option(() => reader.pubkey());
}

/** Contents of the receiver's singleton `Config` account. */
export type SvmReceiverConfig = {
  /** The key allowed to run the receiver's governance instructions. */
  governanceAuthority: PublicKey;
  targetGovernanceAuthority: PublicKey | undefined;
  /** Core bridge the receiver verifies price update VAAs against. */
  wormhole: PublicKey;
  validDataSources: DataSource[];
  singleUpdateFeeInLamports: bigint;
  minimumSignatures: number;
};

/**
 * The Pyth price receiver (`pyth-solana-receiver`) on an SVM chain.
 *
 * Unlike the EVM / Sui / Aptos price feed contracts, this program is not driven
 * by Pyth governance VAAs: its `Config` names a `governance_authority` key and
 * every governance instruction is a plain Anchor instruction gated on that key
 * signing. On mainnet SVM chains that key is a Squads vault authority — the
 * vault's own authority PDA locally, or the vault's remote executor PDA on a
 * remote chain.
 */
export class SvmPriceFeedContract extends Storable {
  static type = "SvmPriceFeedContract";

  /**
   * @param chain - the SVM chain this program is deployed on
   * @param address - base58 program id of the `pyth-solana-receiver` deployment
   */
  constructor(
    public readonly chain: SvmChain,
    public readonly address: string,
  ) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string },
  ): SvmPriceFeedContract {
    if (parsed.type !== SvmPriceFeedContract.type) {
      throw new Error("Invalid type");
    }
    if (!(chain instanceof SvmChain)) {
      throw new Error(`Wrong chain type ${chain.getId()}`);
    }
    return new SvmPriceFeedContract(chain, parsed.address);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return SvmPriceFeedContract.type;
  }

  getChain(): SvmChain {
    return this.chain;
  }

  toJson(): KeyValueConfig {
    return {
      address: this.address,
      chain: this.chain.getId(),
      type: SvmPriceFeedContract.type,
    };
  }

  getProgramId(): PublicKey {
    return new PublicKey(this.address);
  }

  /**
   * The key the BPF upgradeable loader lets upgrade this program, or `undefined`
   * if the program has been made immutable.
   */
  getUpgradeAuthority(): Promise<PublicKey | undefined> {
    return getUpgradeAuthority(this.chain, this.getProgramId());
  }

  /** Address of the singleton `Config` PDA (`b"config"`). */
  getConfigAddress(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      this.getProgramId(),
    )[0];
  }

  async getConfig(): Promise<SvmReceiverConfig> {
    const account = await this.chain
      .getConnection()
      .getAccountInfo(this.getConfigAddress());
    if (!account) {
      throw new Error(
        `Receiver ${this.getId()} has no config account — is the program initialized?`,
      );
    }
    const reader = new BorshReader(account.data);
    reader.skip(discriminator("account", "Config").length);
    // Each field has to be read into its own binding rather than straight into the
    // returned object: borsh has no field names, so the reads have to happen in
    // declaration order, and the formatter sorts object keys alphabetically.
    const governanceAuthority = reader.pubkey();
    const targetGovernanceAuthority = reader.option(() => reader.pubkey());
    const wormhole = reader.pubkey();
    const validDataSources = reader.vec(() => {
      const emitterChain = reader.u16();
      const emitterAddress = reader.bytes(32).toString("hex");
      return { emitterAddress, emitterChain };
    });
    const singleUpdateFeeInLamports = reader.u64();
    const minimumSignatures = reader.u8();
    return {
      governanceAuthority,
      minimumSignatures,
      singleUpdateFeeInLamports,
      targetGovernanceAuthority,
      validDataSources,
      wormhole,
    };
  }

  /**
   * Build the `set_data_sources` instruction that replaces the whole list of
   * emitters the receiver accepts price updates from.
   */
  generateSetDataSourcesInstruction(
    governanceAuthority: PublicKey,
    dataSources: DataSource[],
  ): TransactionInstruction {
    const args = Buffer.alloc(4 + dataSources.length * 34);
    args.writeUInt32LE(dataSources.length, 0);
    for (const [index, dataSource] of dataSources.entries()) {
      const offset = 4 + index * 34;
      args.writeUInt16LE(dataSource.emitterChain, offset);
      Buffer.from(dataSource.emitterAddress, "hex").copy(args, offset + 2);
    }
    return this.governanceInstruction(
      "set_data_sources",
      governanceAuthority,
      args,
    );
  }

  /** Build the `set_fee` instruction that sets the per-update fee in lamports. */
  generateSetFeeInstruction(
    governanceAuthority: PublicKey,
    singleUpdateFeeInLamports: bigint,
  ): TransactionInstruction {
    const args = Buffer.alloc(8);
    args.writeBigUInt64LE(singleUpdateFeeInLamports);
    return this.governanceInstruction("set_fee", governanceAuthority, args);
  }

  /**
   * Every receiver governance instruction takes the same `Governance` account
   * context: the authority signing, and the config it mutates.
   */
  private governanceInstruction(
    name: string,
    governanceAuthority: PublicKey,
    args: Buffer,
  ): TransactionInstruction {
    return {
      data: Buffer.concat([discriminator("global", name), args]),
      keys: [
        { isSigner: true, isWritable: false, pubkey: governanceAuthority },
        { isSigner: false, isWritable: true, pubkey: this.getConfigAddress() },
      ],
      programId: this.getProgramId(),
    };
  }
}

/** Contents of the core bridge's singleton `Config` account. */
export type SvmBridgeConfig = {
  /** Index of the guardian set the bridge currently verifies VAAs against. */
  guardianSetIndex: number;
  /** How long a guardian set stays valid after a newer one has replaced it. */
  guardianSetTtlSeconds: number;
  /** What the bridge charges to post a message. */
  feeLamports: bigint;
};

/** Contents of a core bridge `GuardianSet` account. */
export type SvmGuardianSet = {
  index: number;
  /** Guardian addresses as 40-character hex strings, without a `0x` prefix. */
  keys: string[];
  creationTime: number;
  /** Unix seconds after which this set's VAAs stop being accepted; 0 means never. */
  expirationTime: number;
};

/**
 * The Wormhole core bridge on an SVM chain.
 *
 * This is deliberately not a {@link WormholeContract}: the SVM bridge has no
 * on-chain chain id to report, and its guardian sets are advanced by posting
 * governance VAAs rather than by the `upgradeGuardianSets` call that interface
 * models. Only the reads and instruction builders the guardian set migration
 * needs live here.
 */
export class SvmWormholeContract extends Storable {
  static type = "SvmWormholeContract";

  /**
   * @param chain - the SVM chain this program is deployed on
   * @param address - base58 program id of the core bridge deployment
   */
  constructor(
    public readonly chain: SvmChain,
    public readonly address: string,
  ) {
    super();
  }

  static fromJson(
    chain: Chain,
    parsed: { type: string; address: string },
  ): SvmWormholeContract {
    if (parsed.type !== SvmWormholeContract.type) {
      throw new Error("Invalid type");
    }
    if (!(chain instanceof SvmChain)) {
      throw new Error(`Wrong chain type ${chain.getId()}`);
    }
    return new SvmWormholeContract(chain, parsed.address);
  }

  getId(): string {
    return `${this.chain.getId()}_${this.address}`;
  }

  getType(): string {
    return SvmWormholeContract.type;
  }

  getChain(): SvmChain {
    return this.chain;
  }

  toJson(): KeyValueConfig {
    return {
      address: this.address,
      chain: this.chain.getId(),
      type: SvmWormholeContract.type,
    };
  }

  getProgramId(): PublicKey {
    return new PublicKey(this.address);
  }

  /** Address of the bridge's singleton `Config` PDA (`b"Bridge"`). */
  getConfigAddress(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Bridge")],
      this.getProgramId(),
    )[0];
  }

  /** Address of the `GuardianSet` PDA for `index` (`b"GuardianSet"` + big-endian index). */
  getGuardianSetAddress(index: number): PublicKey {
    const indexBytes = Buffer.alloc(4);
    indexBytes.writeUInt32BE(index);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("GuardianSet"), indexBytes],
      this.getProgramId(),
    )[0];
  }

  /** Address of the fee collector the bridge charges `post_message` against. */
  private getFeeCollectorAddress(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("fee_collector")],
      this.getProgramId(),
    )[0];
  }

  async getConfig(): Promise<SvmBridgeConfig> {
    const account = await this.chain
      .getConnection()
      .getAccountInfo(this.getConfigAddress());
    if (!account) {
      throw new Error(
        `Core bridge ${this.getId()} has no config account — is the program initialized?`,
      );
    }
    // The bridge config is a legacy account: no discriminator, and a gap where the
    // old implementation tracked the fees it had been paid.
    const reader = new BorshReader(account.data);
    const guardianSetIndex = reader.u32();
    reader.skip(8);
    const guardianSetTtlSeconds = reader.u32();
    const feeLamports = reader.u64();
    return { feeLamports, guardianSetIndex, guardianSetTtlSeconds };
  }

  async getCurrentGuardianSetIndex(): Promise<number> {
    const { guardianSetIndex } = await this.getConfig();
    return guardianSetIndex;
  }

  /**
   * Read every guardian set account the bridge still has, from index 0 up to and
   * including the current one. Sets are only ever created in order, but any of
   * them may already have been closed, so gaps are expected on a re-run.
   */
  async getGuardianSets(): Promise<SvmGuardianSet[]> {
    const currentIndex = await this.getCurrentGuardianSetIndex();
    const indexes = Array.from({ length: currentIndex + 1 }, (_, i) => i);
    const accounts = await this.chain
      .getConnection()
      .getMultipleAccountsInfo(
        indexes.map((index) => this.getGuardianSetAddress(index)),
      );
    return accounts
      .filter((account): account is AccountInfo<Buffer> => account !== null)
      .map((account) => decodeGuardianSet(account.data));
  }

  /**
   * The key the BPF upgradeable loader lets upgrade this program, or `undefined`
   * if the program has been made immutable.
   */
  getUpgradeAuthority(): Promise<PublicKey | undefined> {
    return getUpgradeAuthority(this.chain, this.getProgramId());
  }

  /**
   * Build the loader instruction that upgrades this program to the ELF staged in
   * `buffer`, refunding the buffer's rent to `spill`.
   */
  generateUpgradeInstruction(
    buffer: PublicKey,
    upgradeAuthority: PublicKey,
    spill: PublicKey,
  ): TransactionInstruction {
    return getUpgradeInstruction(
      this.getProgramId(),
      buffer,
      upgradeAuthority,
      spill,
    );
  }

  /**
   * Build the permissionless `close_guardian_set` instruction, which deletes the
   * guardian set at `index` and refunds its rent to `recipient`.
   *
   * The instruction only exists in the migrated build, and the program refuses
   * to close a set that holds none of the guardians it knows to be Wormhole's.
   */
  generateCloseGuardianSetInstruction(
    recipient: PublicKey,
    index: number,
  ): TransactionInstruction {
    return {
      // Legacy instructions are dispatched on a single-byte borsh enum selector
      // rather than an Anchor discriminator, and `EmptyArgs` adds nothing.
      data: Buffer.of(LEGACY_INSTRUCTION_CLOSE_GUARDIAN_SET),
      keys: [
        { isSigner: false, isWritable: true, pubkey: recipient },
        {
          isSigner: false,
          isWritable: true,
          pubkey: this.getGuardianSetAddress(index),
        },
      ],
      programId: this.getProgramId(),
    };
  }

  /**
   * Build the permissionless `initialize` instruction, which rewrites the bridge
   * config and recreates guardian set 0 holding the Pyth multisig.
   *
   * The migrated build ignores `InitializeArgs` entirely — it always installs the
   * Pyth multisig at a fixed TTL and fee — but the args still have to
   * deserialize, so zeros go on the wire.
   */
  generateInitializeInstruction(payer: PublicKey): TransactionInstruction {
    const args = Buffer.alloc(4 + 8 + 4); // guardian_set_ttl_seconds, fee_lamports, initial_guardians
    return {
      data: Buffer.concat([Buffer.of(LEGACY_INSTRUCTION_INITIALIZE), args]),
      keys: [
        { isSigner: false, isWritable: true, pubkey: this.getConfigAddress() },
        {
          isSigner: false,
          isWritable: true,
          pubkey: this.getGuardianSetAddress(0),
        },
        {
          isSigner: false,
          isWritable: true,
          pubkey: this.getFeeCollectorAddress(),
        },
        { isSigner: true, isWritable: true, pubkey: payer },
        { isSigner: false, isWritable: false, pubkey: SYSVAR_CLOCK_PUBKEY },
        { isSigner: false, isWritable: false, pubkey: SYSVAR_RENT_PUBKEY },
        { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
      ],
      programId: this.getProgramId(),
    };
  }
}

/**
 * Positions of the two legacy selectors this module emits within the core
 * bridge's `LegacyInstruction` enum. The enum keeps placeholder variants for
 * every instruction that has been removed so these values never shift.
 */
const LEGACY_INSTRUCTION_INITIALIZE = 0;
const LEGACY_INSTRUCTION_CLOSE_GUARDIAN_SET = 10;

/**
 * Guardian sets created by the original Wormhole program carry no discriminator,
 * while ones written by an Anchor instruction do. The bridge itself accepts both
 * (`AccountVariant`), so both have to be read here.
 */
function decodeGuardianSet(data: Buffer): SvmGuardianSet {
  const anchorDiscriminator = discriminator("account", "GuardianSet");
  const reader = new BorshReader(data);
  if (
    data.subarray(0, anchorDiscriminator.length).equals(anchorDiscriminator)
  ) {
    reader.skip(anchorDiscriminator.length);
  }
  const index = reader.u32();
  const keys = reader.vec(() => reader.bytes(20).toString("hex"));
  const creationTime = reader.u32();
  const expirationTime = reader.u32();
  return { creationTime, expirationTime, index, keys };
}
