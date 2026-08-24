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
  // `UpgradeableLoaderState::ProgramData`: a 4-byte discriminant, a deployment slot, then the
  // authority as an `Option<Pubkey>`.
  const optionOffset = 4 + 8;
  return account.data.readUInt8(optionOffset) === 0
    ? undefined
    : new PublicKey(account.data.subarray(optionOffset + 1, optionOffset + 33));
}

export type SvmReceiverConfig = {
  governanceAuthority: PublicKey;
  targetGovernanceAuthority: PublicKey | undefined;
  wormhole: PublicKey;
  validDataSources: DataSource[];
  singleUpdateFeeInLamports: bigint;
  minimumSignatures: number;
};

export class SvmPriceFeedContract extends Storable {
  static type = "SvmPriceFeedContract";

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

export type SvmBridgeConfig = {
  guardianSetIndex: number;
  guardianSetTtlSeconds: number;
  feeLamports: bigint;
};

export type SvmGuardianSet = {
  index: number;
  keys: string[];
  creationTime: number;
  expirationTime: number;
};

export class SvmWormholeContract extends Storable {
  static type = "SvmWormholeContract";

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

  getConfigAddress(): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Bridge")],
      this.getProgramId(),
    )[0];
  }

  getGuardianSetAddress(index: number): PublicKey {
    const indexBytes = Buffer.alloc(4);
    indexBytes.writeUInt32BE(index);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("GuardianSet"), indexBytes],
      this.getProgramId(),
    )[0];
  }

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
    // A legacy account with no anchor discriminator, so the IDL carries it as a type rather than
    // as one of the program's accounts.
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

  getUpgradeAuthority(): Promise<PublicKey | undefined> {
    return getUpgradeAuthority(this.chain, this.getProgramId());
  }

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

  generateCloseGuardianSetInstruction(
    recipient: PublicKey,
    index: number,
  ): TransactionInstruction {
    return {
      // Legacy instructions dispatch on a one-byte enum selector, not an anchor discriminator.
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

  generateInitializeInstruction(payer: PublicKey): TransactionInstruction {
    const args = Buffer.alloc(4 + 8 + 4); // ttl, fee, initial_guardians: ignored by the migrated build, still deserialized
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

// Not read from the IDL: the published one is of the pre-migration program, whose enum stops at
// `PostMessageUnreliable`. Removed variants keep placeholders, so these indices never shift.
const LEGACY_INSTRUCTION_INITIALIZE = 0;
const LEGACY_INSTRUCTION_CLOSE_GUARDIAN_SET = 10;

// Guardian sets written by the original wormhole program carry no anchor discriminator, and
// `decodeUnchecked` always skips one, so a legacy account gets a stand-in.
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
