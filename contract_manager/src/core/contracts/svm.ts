import { Wallet } from "@coral-xyz/anchor";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import type { DataSource } from "@pythnetwork/xc-admin-common";
import {
  getProgramDataAddress,
  getUpgradeInstruction,
} from "@pythnetwork/xc-admin-common";
import type { AccountInfo, TransactionInstruction } from "@solana/web3.js";
import {
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";

import type { KeyValueConfig } from "../base";
import { Storable } from "../base";
import type { Chain } from "../chains";
import { SvmChain } from "../chains";

/**
 * Anchor clients for the receiver and the core bridge, built by the receiver SDK.
 *
 * Their IDLs are in the pre-0.30 format, which the anchor this package depends on can no longer
 * instantiate, and `PythSolanaReceiver` already owns `Program`s built with the anchor version
 * those IDLs match. The wallet it needs is never used: every instruction built here is left
 * unsigned for the multisig, and everything else is a read.
 */
function getPrograms(
  chain: SvmChain,
  programIds: { receiverProgramId?: PublicKey; wormholeProgramId?: PublicKey },
): PythSolanaReceiver {
  return new PythSolanaReceiver({
    connection: chain.getConnection(),
    wallet: new Wallet(Keypair.generate()),
    ...programIds,
  });
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
  // The loader's own accounts have no IDL: `UpgradeableLoaderState::ProgramData` is a 4-byte
  // discriminant, a deployment slot, then the authority as an `Option<Pubkey>`.
  const optionOffset = 4 + 8;
  return account.data.readUInt8(optionOffset) === 0
    ? undefined
    : new PublicKey(account.data.subarray(optionOffset + 1, optionOffset + 33));
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
    const config = this.getProgram().coder.accounts.decode<{
      governanceAuthority: PublicKey;
      targetGovernanceAuthority: PublicKey | null;
      wormhole: PublicKey;
      validDataSources: { chain: number; emitter: PublicKey }[];
      singleUpdateFeeInLamports: BN;
      minimumSignatures: number;
    }>("Config", account.data);
    // The IDL's `DataSource` is `{ chain, emitter }`; the rest of contract_manager speaks
    // `xc_admin_common`'s `{ emitterChain, emitterAddress }`.
    return {
      governanceAuthority: config.governanceAuthority,
      minimumSignatures: config.minimumSignatures,
      singleUpdateFeeInLamports: BigInt(
        config.singleUpdateFeeInLamports.toString(),
      ),
      targetGovernanceAuthority: config.targetGovernanceAuthority ?? undefined,
      validDataSources: config.validDataSources.map((source) => ({
        emitterAddress: source.emitter.toBuffer().toString("hex"),
        emitterChain: source.chain,
      })),
      wormhole: config.wormhole,
    };
  }

  /**
   * Build the `set_data_sources` instruction that replaces the whole list of
   * emitters the receiver accepts price updates from.
   */
  generateSetDataSourcesInstruction(
    governanceAuthority: PublicKey,
    dataSources: DataSource[],
  ): Promise<TransactionInstruction> {
    return this.getProgram()
      .methods.setDataSources(
        dataSources.map((dataSource) => ({
          chain: dataSource.emitterChain,
          emitter: new PublicKey(Buffer.from(dataSource.emitterAddress, "hex")),
        })),
      )
      .accounts({
        config: this.getConfigAddress(),
        payer: governanceAuthority,
      })
      .instruction();
  }

  /** Build the `set_fee` instruction that sets the per-update fee in lamports. */
  generateSetFeeInstruction(
    governanceAuthority: PublicKey,
    singleUpdateFeeInLamports: bigint,
  ): Promise<TransactionInstruction> {
    return this.getProgram()
      .methods.setFee(new BN(singleUpdateFeeInLamports.toString()))
      .accounts({
        config: this.getConfigAddress(),
        payer: governanceAuthority,
      })
      .instruction();
  }

  private getProgram() {
    return getPrograms(this.chain, { receiverProgramId: this.getProgramId() })
      .receiver;
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
    // The bridge config is a legacy account with no anchor discriminator, so the IDL knows it as
    // a plain type rather than as one of the program's accounts.
    const config = this.getProgram().coder.types.decode("Config", account.data);
    return {
      feeLamports: BigInt(config.feeLamports.toString()),
      guardianSetIndex: config.guardianSetIndex,
      guardianSetTtlSeconds: config.guardianSetTtl.seconds,
    };
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
    const program = this.getProgram();
    return accounts
      .filter((account): account is AccountInfo<Buffer> => account !== null)
      .map((account) => decodeGuardianSet(program, account.data));
  }

  private getProgram() {
    return getPrograms(this.chain, { wormholeProgramId: this.getProgramId() })
      .wormhole;
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
 * bridge's `LegacyInstruction` enum. They are not read out of the IDL because the
 * published one is of the pre-migration program, whose enum stops at
 * `PostMessageUnreliable`; `CloseGuardianSet` only exists in the migrated build.
 * The enum keeps placeholder variants for every instruction that has been removed
 * so these values never shift.
 */
const LEGACY_INSTRUCTION_INITIALIZE = 0;
const LEGACY_INSTRUCTION_CLOSE_GUARDIAN_SET = 10;

/**
 * Guardian sets are stored as an `AccountVariant`: one written by the original
 * Wormhole program carries no anchor discriminator, while one written by an anchor
 * instruction does, and the bridge accepts both. `decodeUnchecked` always assumes
 * the latter, so a legacy account is given a stand-in for it to skip over.
 */
function decodeGuardianSet(
  program: PythSolanaReceiver["wormhole"],
  data: Buffer,
): SvmGuardianSet {
  const discriminator = Buffer.from(
    bs58.decode(program.coder.accounts.memcmp("guardianSet").bytes as string),
  );
  const set = program.coder.accounts.decodeUnchecked<{
    index: number;
    keys: number[][];
    creationTime: { value: number };
    expirationTime: { value: number };
  }>(
    "guardianSet",
    data.subarray(0, discriminator.length).equals(discriminator)
      ? data
      : Buffer.concat([Buffer.alloc(discriminator.length), data]),
  );
  return {
    creationTime: set.creationTime.value,
    expirationTime: set.expirationTime.value,
    index: set.index,
    keys: set.keys.map((key) => Buffer.from(key).toString("hex")),
  };
}
