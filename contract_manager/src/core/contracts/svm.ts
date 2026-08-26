/** biome-ignore-all lint/suspicious/noConsole: progress output of the CLI scripts that call this */

import { parseVaa, postVaaSolana } from "@certusone/wormhole-sdk";
import { signTransactionFactory } from "@certusone/wormhole-sdk/lib/cjs/solana/index.js";
import { derivePostedVaaKey } from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole/index.js";
import { Wallet } from "@coral-xyz/anchor";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import type { DataSource } from "@pythnetwork/xc-admin-common";
import {
  CLAIM_RECORD_SEED,
  decodeGovernancePayload,
  ExecutePostedVaa,
  getProgramDataAddress,
  getRemoteExecutorProgram,
  getUpgradeInstruction,
  mapKey,
  REMOTE_EXECUTOR_ADDRESS,
} from "@pythnetwork/xc-admin-common";
import type {
  AccountInfo,
  AccountMeta,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";

import type { KeyValueConfig, PriceFeed, PrivateKey, TxResult } from "../base";
import { PriceFeedContract } from "../base";
import type { Chain } from "../chains";
import { SvmChain } from "../chains";
import { WormholeContract } from "./wormhole";

// The shard of push oracle price feed accounts this reads and writes. Shard 0 is the one the
// hermes-backed pushers keep up to date.
const PUSH_ORACLE_SHARD_ID = 0;

function getPrograms(
  chain: SvmChain,
  programIds: { receiverProgramId?: PublicKey; wormholeProgramId?: PublicKey },
  wallet: Wallet = new Wallet(Keypair.generate()),
): PythSolanaReceiver {
  return new PythSolanaReceiver({
    connection: chain.getConnection(),
    wallet,
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

export class SvmPriceFeedContract extends PriceFeedContract {
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

  async getDataSources(): Promise<DataSource[]> {
    return (await this.getConfig()).validDataSources;
  }

  async getBaseUpdateFee(): Promise<{ amount: string; denom?: string }> {
    const { singleUpdateFeeInLamports } = await this.getConfig();
    return { amount: singleUpdateFeeInLamports.toString(), denom: "lamports" };
  }

  async getPriceFeed(feedId: string): Promise<PriceFeed | undefined> {
    const account = await this.getReceiver().fetchPriceFeedAccount(
      PUSH_ORACLE_SHARD_ID,
      feedId,
    );
    if (!account) {
      return undefined;
    }
    const message = account.priceMessage;
    const expo = message.exponent.toString();
    const publishTime = message.publishTime.toString();
    return {
      emaPrice: {
        conf: message.emaConf.toString(),
        expo,
        price: message.emaPrice.toString(),
        publishTime,
      },
      price: {
        conf: message.conf.toString(),
        expo,
        price: message.price.toString(),
        publishTime,
      },
    };
  }

  async executeUpdatePriceFeed(
    senderPrivateKey: PrivateKey,
    vaas: Buffer[],
  ): Promise<TxResult> {
    const receiver = this.getReceiver(
      new Wallet(this.chain.getKeypair(senderPrivateKey)),
    );
    const builder = receiver.newTransactionBuilder({
      closeUpdateAccounts: true,
    });
    await builder.addUpdatePriceFeed(
      vaas.map((vaa) => vaa.toString("base64")),
      PUSH_ORACLE_SHARD_ID,
    );
    const signatures = await receiver.provider.sendAll(
      await builder.buildVersionedTransactions({}),
    );
    const id = signatures.at(-1);
    if (id === undefined) {
      throw new Error(`${this.getId()}: no price update to post`);
    }
    return { id, info: signatures };
  }

  // The receiver has no staleness threshold: how old an update may be is the consumer's call.
  getValidTimePeriod(): Promise<number> {
    throw new Error("Unsupported");
  }

  // The governance source is the vault behind the receiver's `governance_authority`, and that
  // authority is a one-way hash of the vault's emitter, so it cannot be read back from chain.
  getGovernanceDataSource(): Promise<DataSource> {
    throw new Error("Unsupported");
  }

  // Held by the remote executor's claim record, which is keyed by the emitter the sequence
  // belongs to rather than by the receiver.
  getLastExecutedGovernanceSequence(): Promise<number> {
    throw new Error("Unsupported");
  }

  // The receiver is not governed by VAAs directly: the vault emits an `ExecutePostedVaa` message,
  // and the remote executor on this chain replays the instructions it carries, signing them with
  // the PDA the receiver's config names as its governance authority.
  async executeGovernanceInstruction(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const action = decodeGovernancePayload(parseVaa(vaa).payload);
    if (!(action instanceof ExecutePostedVaa)) {
      throw new Error(
        `${this.getId()} only accepts ExecutePostedVaa governance messages`,
      );
    }

    const parsedVaa = parseVaa(vaa);
    const connection = this.chain.getConnection();
    const payer = this.chain.getKeypair(senderPrivateKey);
    const emitter = new PublicKey(parsedVaa.emitterAddress);
    const executorKey = mapKey(emitter);
    const claimRecord = PublicKey.findProgramAddressSync(
      [Buffer.from(CLAIM_RECORD_SEED), emitter.toBuffer()],
      REMOTE_EXECUTOR_ADDRESS,
    )[0];

    const program = getRemoteExecutorProgram(connection);
    const claimRecordAccount = await connection.getAccountInfo(claimRecord);
    if (claimRecordAccount) {
      // The anchor this IDL is built with camel-cases `program.account` at runtime but not at the
      // type level, so the coder is the only way to reach a PascalCase account.
      const { sequence } = program.coder.accounts.decode<{ sequence: BN }>(
        "ClaimRecord",
        claimRecordAccount.data,
      );
      if (sequence.gte(new BN(parsedVaa.sequence.toString()))) {
        console.log(
          `Skipping on ${this.getId()} as sequence ${parsedVaa.sequence} was already executed`,
        );
        return { id: "", info: { executedSequence: sequence.toNumber() } };
      }
    }

    // The executor requires the posted VAA to be owned by the core bridge the receiver itself
    // verifies against.
    const { wormhole } = await this.getConfig();
    const postedVaa = derivePostedVaaKey(wormhole, parsedVaa.hash);
    if (await connection.getAccountInfo(postedVaa)) {
      console.log(`VAA is already posted on ${this.getId()} at ${postedVaa}`);
    } else {
      await postVaaSolana(
        connection,
        signTransactionFactory(payer),
        wormhole,
        payer.publicKey,
        vaa,
      );
      console.log(`Posted VAA on ${this.getId()} at ${postedVaa}`);
    }

    // Every account the CPI'd instructions touch has to ride along, led by the signing PDA.
    const remainingAccounts: AccountMeta[] = [
      { isSigner: false, isWritable: true, pubkey: executorKey },
    ];
    for (const instruction of action.instructions) {
      remainingAccounts.push(
        { isSigner: false, isWritable: false, pubkey: instruction.programId },
        ...instruction.keys.filter((key) => !key.pubkey.equals(executorKey)),
      );
    }

    const id = await sendAndConfirmTransaction(
      connection,
      new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(
          await program.methods
            .executePostedVaa()
            .accounts({ claimRecord, payer: payer.publicKey, postedVaa })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ),
      [payer],
    );
    console.log(`Executed on ${this.getId()} with txHash: ${id}`);
    return { id, info: { postedVaa: postedVaa.toBase58() } };
  }

  private getReceiver(wallet?: Wallet): PythSolanaReceiver {
    return getPrograms(
      this.chain,
      { receiverProgramId: this.getProgramId() },
      wallet,
    );
  }

  private getProgram() {
    return this.getReceiver().receiver;
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

export class SvmWormholeContract extends WormholeContract {
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

  // The chain id is a compile-time constant of the program rather than a field of its config, so
  // there is nothing on chain to read it back from.
  getChainId(): Promise<number> {
    throw new Error("Unsupported");
  }

  async getGuardianSet(): Promise<string[]> {
    const index = await this.getCurrentGuardianSetIndex();
    const account = await this.chain
      .getConnection()
      .getAccountInfo(this.getGuardianSetAddress(index));
    if (!account) {
      throw new Error(
        `Core bridge ${this.getId()} is on guardian set ${index}, which has already been closed`,
      );
    }
    return decodeGuardianSet(this.getProgram(), account.data).keys;
  }

  async upgradeGuardianSets(
    senderPrivateKey: PrivateKey,
    vaa: Buffer,
  ): Promise<TxResult> {
    const connection = this.chain.getConnection();
    const payer = this.chain.getKeypair(senderPrivateKey);
    const programId = this.getProgramId();
    const parsedVaa = parseVaa(vaa);
    const postedVaa = derivePostedVaaKey(programId, parsedVaa.hash);
    if (!(await connection.getAccountInfo(postedVaa))) {
      await postVaaSolana(
        connection,
        signTransactionFactory(payer),
        programId,
        payer.publicKey,
        vaa,
      );
    }

    const currentIndex = await this.getCurrentGuardianSetIndex();
    const sequence = Buffer.alloc(8);
    sequence.writeBigUInt64BE(parsedVaa.sequence);
    const emitterChain = Buffer.alloc(2);
    emitterChain.writeUInt16BE(parsedVaa.emitterChain);
    const claim = PublicKey.findProgramAddressSync(
      [parsedVaa.emitterAddress, emitterChain, sequence],
      programId,
    )[0];

    const id = await sendAndConfirmTransaction(
      connection,
      new Transaction().add({
        data: Buffer.of(LEGACY_INSTRUCTION_GUARDIAN_SET_UPDATE),
        keys: [
          { isSigner: true, isWritable: true, pubkey: payer.publicKey },
          {
            isSigner: false,
            isWritable: true,
            pubkey: this.getConfigAddress(),
          },
          { isSigner: false, isWritable: false, pubkey: postedVaa },
          { isSigner: false, isWritable: true, pubkey: claim },
          {
            isSigner: false,
            isWritable: true,
            pubkey: this.getGuardianSetAddress(currentIndex),
          },
          {
            isSigner: false,
            isWritable: true,
            pubkey: this.getGuardianSetAddress(currentIndex + 1),
          },
          {
            isSigner: false,
            isWritable: false,
            pubkey: SystemProgram.programId,
          },
        ],
        programId,
      }),
      [payer],
    );
    return { id, info: { guardianSetIndex: currentIndex + 1 } };
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
        { isSigner: false, isWritable: true, pubkey: this.getConfigAddress() },
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
const LEGACY_INSTRUCTION_GUARDIAN_SET_UPDATE = 6;
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
