import crypto from "crypto"; // eslint-disable-line unicorn/prefer-node-protocol

import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  getTokenOwnerRecordAddress,
  PROGRAM_VERSION_V2,
  withCreateTokenOwnerRecord,
} from "@solana/spl-governance";
import type { Account, Mint } from "@solana/spl-token";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { JSONParser } from "@streamparser/json";
import { z } from "zod";

import {
  GOVERNANCE_ADDRESS,
  MAX_VOTER_WEIGHT,
  FRACTION_PRECISION_N,
  ONE_YEAR_IN_SECONDS,
  POSITIONS_ACCOUNT_SIZE,
} from "./constants.js";
import IntegrityPoolIdl from "./idl/integrity-pool.json" with { type: "json" };
import PublisherCapsIdl from "./idl/publisher-caps.json" with { type: "json" };
import StakingIdl from "./idl/staking.json" with { type: "json" };
import {
  getConfigAddress,
  getDelegationRecordAddress,
  getPoolConfigAddress,
  getStakeAccountCustodyAddress,
  getStakeAccountMetadataAddress,
  getTargetAccountAddress,
} from "./pdas.js";
import type { IntegrityPool } from "./types/integrity-pool.js";
import type { PublisherCaps } from "./types/publisher-caps.js";
import type { Staking } from "./types/staking.js";
import type {
  GlobalConfig,
  PoolConfig,
  PoolDataAccount,
  StakeAccountPositions,
  TargetAccount,
  VoterWeightAction,
  VestingSchedule,
} from "./types.js";
import { PositionState } from "./types.js";
import { bigintMax, bigintMin } from "./utils/bigint.js";
import { convertBigIntToBN, convertBNToBigInt } from "./utils/bn.js";
import { epochToDate, getCurrentEpoch } from "./utils/clock.js";
import { extractPublisherData } from "./utils/pool.js";
import {
  deserializeStakeAccountPositions,
  getPositionState,
  getVotingTokenAmount,
} from "./utils/position.js";
import { sendTransaction } from "./utils/transaction.js";
import { getUnlockSchedule } from "./utils/vesting.js";
import type { PythStakingWallet } from "./utils/wallet.js";
import { DummyWallet } from "./utils/wallet.js";

export type PythStakingClientConfig = {
  connection: Connection;
  wallet?: PythStakingWallet;
};

export class PythStakingClient {
  connection: Connection;
  wallet: PythStakingWallet;
  provider: AnchorProvider;
  stakingProgram: Program<Staking>;
  integrityPoolProgram: Program<IntegrityPool>;
  publisherCapsProgram: Program<PublisherCaps>;

  constructor(config: PythStakingClientConfig) {
    const { connection, wallet = DummyWallet } = config;

    this.connection = connection;
    this.wallet = wallet;

    this.provider = new AnchorProvider(this.connection, this.wallet, {
      skipPreflight: true,
    });
    this.stakingProgram = new Program(StakingIdl as Staking, this.provider);
    this.integrityPoolProgram = new Program(
      IntegrityPoolIdl as IntegrityPool,
      this.provider,
    );
    this.publisherCapsProgram = new Program(
      PublisherCapsIdl as PublisherCaps,
      this.provider,
    );
  }

  async initGlobalConfig(config: GlobalConfig) {
    const globalConfigAnchor = convertBigIntToBN(config);
    const instruction = await this.stakingProgram.methods
      .initConfig(globalConfigAnchor)
      .instruction();

    return sendTransaction([instruction], this.connection, this.wallet);
  }

  async getGlobalConfig(): Promise<GlobalConfig> {
    const globalConfigAnchor =
      await this.stakingProgram.account.globalConfig.fetch(
        getConfigAddress()[0],
      );
    return convertBNToBigInt(globalConfigAnchor);
  }

  /** Gets a users stake accounts */
  public async getAllStakeAccountPositions(
    owner?: PublicKey,
  ): Promise<PublicKey[]> {
    const positionDataMemcmp = this.stakingProgram.coder.accounts.memcmp(
      "positionData",
    ) as {
      offset: number;
      bytes: string;
    };
    const res =
      await this.stakingProgram.provider.connection.getProgramAccounts(
        this.stakingProgram.programId,
        {
          encoding: "base64",
          filters: [
            {
              memcmp: positionDataMemcmp,
            },
            {
              memcmp: {
                offset: 8,
                bytes: owner?.toBase58() ?? this.wallet.publicKey.toBase58(),
              },
            },
          ],
        },
      );
    return res.map((account) => account.pubkey);
  }

  public async getStakeAccountPositions(
    stakeAccountPositions: PublicKey,
  ): Promise<StakeAccountPositions> {
    const account =
      await this.stakingProgram.provider.connection.getAccountInfo(
        stakeAccountPositions,
      );

    if (account === null) {
      throw new Error("Stake account not found");
    }

    return deserializeStakeAccountPositions(
      stakeAccountPositions,
      account.data,
      this.stakingProgram.idl,
    );
  }

  public async getDelegationRecord(
    stakeAccountPositions: PublicKey,
    publisher: PublicKey,
  ) {
    return this.integrityPoolProgram.account.delegationRecord
      .fetchNullable(
        getDelegationRecordAddress(stakeAccountPositions, publisher),
      )
      .then((record) => convertBNToBigInt(record));
  }

  public async getStakeAccountCustody(
    stakeAccountPositions: PublicKey,
  ): Promise<Account> {
    return getAccount(
      this.connection,
      getStakeAccountCustodyAddress(stakeAccountPositions),
    );
  }

  public async initializePool({
    rewardProgramAuthority,
    poolData,
    y,
  }: {
    rewardProgramAuthority: PublicKey;
    poolData: PublicKey;
    y: bigint;
  }) {
    const yAnchor = convertBigIntToBN(y);
    const instruction = await this.integrityPoolProgram.methods
      .initializePool(rewardProgramAuthority, yAnchor)
      .accounts({
        poolData,
        slashCustody: getStakeAccountCustodyAddress(poolData),
      })
      .instruction();

    return sendTransaction([instruction], this.connection, this.wallet);
  }

  public async getOwnerPythAtaAccount(): Promise<Account> {
    const globalConfig = await this.getGlobalConfig();
    return getAccount(
      this.connection,
      getAssociatedTokenAddressSync(
        globalConfig.pythTokenMint,
        this.wallet.publicKey,
        true,
      ),
    );
  }

  public async getOwnerPythBalance(): Promise<bigint> {
    try {
      const ataAccount = await this.getOwnerPythAtaAccount();
      return ataAccount.amount;
    } catch {
      return 0n;
    }
  }

  public async getPoolConfigAccount(): Promise<PoolConfig> {
    const poolConfigAnchor =
      await this.integrityPoolProgram.account.poolConfig.fetch(
        getPoolConfigAddress(),
      );
    return convertBNToBigInt(poolConfigAnchor);
  }

  public async getPoolDataAccount(): Promise<PoolDataAccount> {
    const poolConfig = await this.getPoolConfigAccount();
    const poolDataAddress = poolConfig.poolData;
    const poolDataAccountAnchor =
      await this.integrityPoolProgram.account.poolData.fetch(poolDataAddress);
    return convertBNToBigInt(poolDataAccountAnchor);
  }

  public async stakeToGovernance(
    stakeAccountPositions: PublicKey,
    amount: bigint,
  ) {
    const globalConfig = await this.getGlobalConfig();
    const instructions: TransactionInstruction[] = [];

    if (!(await this.hasGovernanceRecord(globalConfig))) {
      await withCreateTokenOwnerRecord(
        instructions,
        GOVERNANCE_ADDRESS,
        PROGRAM_VERSION_V2,
        globalConfig.pythGovernanceRealm,
        this.wallet.publicKey,
        globalConfig.pythTokenMint,
        this.wallet.publicKey,
      );
    }

    if (!(await this.hasJoinedDaoLlc(stakeAccountPositions))) {
      instructions.push(
        await this.getJoinDaoLlcInstruction(stakeAccountPositions),
      );
    }

    instructions.push(
      await this.stakingProgram.methods
        .createPosition(
          {
            voting: {},
          },
          new BN(amount.toString()),
        )
        .accounts({
          stakeAccountPositions,
        })
        .instruction(),
      await this.stakingProgram.methods
        .mergeTargetPositions({ voting: {} })
        .accounts({
          stakeAccountPositions,
        })
        .instruction(),
    );

    return sendTransaction(instructions, this.connection, this.wallet);
  }

  public async unstakeFromGovernance(
    stakeAccountPositions: PublicKey,
    positionState: PositionState.LOCKED | PositionState.LOCKING,
    amount: bigint,
  ) {
    const stakeAccountPositionsData = await this.getStakeAccountPositions(
      stakeAccountPositions,
    );
    const currentEpoch = await getCurrentEpoch(this.connection);

    let remainingAmount = amount;
    const instructionPromises: Promise<TransactionInstruction>[] = [];

    const eligiblePositions = stakeAccountPositionsData.data.positions
      .map((p, i) => ({ position: p, index: i }))
      .reverse()
      .filter(
        ({ position }) =>
          position.targetWithParameters.voting !== undefined &&
          positionState === getPositionState(position, currentEpoch),
      );

    for (const { position, index } of eligiblePositions) {
      if (position.amount < remainingAmount) {
        instructionPromises.push(
          this.stakingProgram.methods
            .closePosition(index, convertBigIntToBN(position.amount), {
              voting: {},
            })
            .accounts({
              stakeAccountPositions,
            })
            .instruction(),
        );
        remainingAmount -= position.amount;
      } else {
        instructionPromises.push(
          this.stakingProgram.methods
            .closePosition(index, convertBigIntToBN(remainingAmount), {
              voting: {},
            })
            .accounts({
              stakeAccountPositions,
            })
            .instruction(),
        );
        break;
      }
    }

    const instructions = await Promise.all(instructionPromises);
    return sendTransaction(instructions, this.connection, this.wallet);
  }

  public async unstakeFromPublisher(
    stakeAccountPositions: PublicKey,
    publisher: PublicKey,
    positionState: PositionState.LOCKED | PositionState.LOCKING,
    amount: bigint,
  ) {
    const stakeAccountPositionsData = await this.getStakeAccountPositions(
      stakeAccountPositions,
    );
    const currentEpoch = await getCurrentEpoch(this.connection);

    let remainingAmount = amount;
    const instructionPromises: Promise<TransactionInstruction>[] = [];

    const eligiblePositions = stakeAccountPositionsData.data.positions
      .map((p, i) => ({ position: p, index: i }))
      .reverse()
      .filter(
        ({ position }) =>
          position.targetWithParameters.integrityPool?.publisher !==
            undefined &&
          position.targetWithParameters.integrityPool.publisher.equals(
            publisher,
          ) &&
          positionState === getPositionState(position, currentEpoch),
      );

    for (const { position, index } of eligiblePositions) {
      if (position.amount < remainingAmount) {
        instructionPromises.push(
          this.integrityPoolProgram.methods
            .undelegate(index, convertBigIntToBN(position.amount))
            .accounts({
              stakeAccountPositions,
              publisher,
            })
            .instruction(),
        );
        remainingAmount -= position.amount;
      } else {
        instructionPromises.push(
          this.integrityPoolProgram.methods
            .undelegate(index, convertBigIntToBN(remainingAmount))
            .accounts({
              stakeAccountPositions,
              publisher,
            })
            .instruction(),
        );
        break;
      }
    }

    const instructions = await Promise.all(instructionPromises);
    return sendTransaction(instructions, this.connection, this.wallet);
  }

  public async unstakeFromAllPublishers(
    stakeAccountPositions: PublicKey,
    positionStates: (PositionState.LOCKED | PositionState.LOCKING)[],
  ) {
    const [stakeAccountPositionsData, currentEpoch] = await Promise.all([
      this.getStakeAccountPositions(stakeAccountPositions),
      getCurrentEpoch(this.connection),
    ]);

    const instructions = await Promise.all(
      stakeAccountPositionsData.data.positions
        .map((position, index) => {
          const publisher =
            position.targetWithParameters.integrityPool?.publisher;
          return publisher === undefined
            ? undefined
            : { position, index, publisher };
        })
        // By separating this filter from the next, typescript can narrow the
        // type and automatically infer that there will be no `undefined` values
        // in the array after this line.  If we combine those filters,
        // typescript won't narrow properly.
        .filter((positionInfo) => positionInfo !== undefined)
        .filter(({ position }) =>
          (positionStates as PositionState[]).includes(
            getPositionState(position, currentEpoch),
          ),
        )
        .reverse()
        .map(({ position, index, publisher }) =>
          this.integrityPoolProgram.methods
            .undelegate(index, convertBigIntToBN(position.amount))
            .accounts({ stakeAccountPositions, publisher })
            .instruction(),
        ),
    );

    return sendTransaction(instructions, this.connection, this.wallet);
  }

  public async hasGovernanceRecord(config: GlobalConfig): Promise<boolean> {
    const tokenOwnerRecordAddress = await getTokenOwnerRecordAddress(
      GOVERNANCE_ADDRESS,
      config.pythGovernanceRealm,
      config.pythTokenMint,
      this.wallet.publicKey,
    );
    const voterAccountInfo =
      await this.stakingProgram.provider.connection.getAccountInfo(
        tokenOwnerRecordAddress,
      );

    return Boolean(voterAccountInfo);
  }

  public async createStakeAccountAndDeposit(amount: bigint) {
    const globalConfig = await this.getGlobalConfig();

    const senderTokenAccount = getAssociatedTokenAddressSync(
      globalConfig.pythTokenMint,
      this.wallet.publicKey,
      true,
    );

    const nonce = crypto.randomBytes(16).toString("hex");
    const stakeAccountPositions = await PublicKey.createWithSeed(
      this.wallet.publicKey,
      nonce,
      this.stakingProgram.programId,
    );

    const minimumBalance =
      await this.stakingProgram.provider.connection.getMinimumBalanceForRentExemption(
        POSITIONS_ACCOUNT_SIZE,
      );

    const instructions = [];

    instructions.push(
      SystemProgram.createAccountWithSeed({
        fromPubkey: this.wallet.publicKey,
        newAccountPubkey: stakeAccountPositions,
        basePubkey: this.wallet.publicKey,
        seed: nonce,
        lamports: minimumBalance,
        space: POSITIONS_ACCOUNT_SIZE,
        programId: this.stakingProgram.programId,
      }),
      await this.stakingProgram.methods
        .createStakeAccount(this.wallet.publicKey, { fullyVested: {} })
        .accounts({
          stakeAccountPositions,
        })
        .instruction(),
      await this.stakingProgram.methods
        .createVoterRecord()
        .accounts({
          stakeAccountPositions,
        })
        .instruction(),
    );

    if (!(await this.hasGovernanceRecord(globalConfig))) {
      await withCreateTokenOwnerRecord(
        instructions,
        GOVERNANCE_ADDRESS,
        PROGRAM_VERSION_V2,
        globalConfig.pythGovernanceRealm,
        this.wallet.publicKey,
        globalConfig.pythTokenMint,
        this.wallet.publicKey,
      );
    }

    instructions.push(
      await this.stakingProgram.methods
        .joinDaoLlc(globalConfig.agreementHash)
        .accounts({
          stakeAccountPositions,
        })
        .instruction(),
      createTransferInstruction(
        senderTokenAccount,
        getStakeAccountCustodyAddress(stakeAccountPositions),
        this.wallet.publicKey,
        amount,
      ),
    );

    await sendTransaction(instructions, this.connection, this.wallet);

    return stakeAccountPositions;
  }

  public async depositTokensToStakeAccountCustody(
    stakeAccountPositions: PublicKey,
    amount: bigint,
  ) {
    const globalConfig = await this.getGlobalConfig();
    const mint = globalConfig.pythTokenMint;

    const senderTokenAccount = getAssociatedTokenAddressSync(
      mint,
      this.wallet.publicKey,
      true,
    );

    const instruction = createTransferInstruction(
      senderTokenAccount,
      getStakeAccountCustodyAddress(stakeAccountPositions),
      this.wallet.publicKey,
      amount,
    );

    return sendTransaction([instruction], this.connection, this.wallet);
  }

  public async withdrawTokensFromStakeAccountCustody(
    stakeAccountPositions: PublicKey,
    amount: bigint,
  ) {
    const globalConfig = await this.getGlobalConfig();
    const mint = globalConfig.pythTokenMint;
    const instructions = [];

    const receiverTokenAccount = getAssociatedTokenAddressSync(
      mint,
      this.wallet.publicKey,
      true,
    );

    // Edge case: if the user doesn't have an ATA, create one
    try {
      await this.getOwnerPythAtaAccount();
    } catch {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          receiverTokenAccount,
          this.wallet.publicKey,
          mint,
        ),
      );
    }

    instructions.push(
      await this.stakingProgram.methods
        .withdrawStake(new BN(amount.toString()))
        .accounts({
          destination: receiverTokenAccount,
          stakeAccountPositions,
        })
        .instruction(),
    );

    return sendTransaction(instructions, this.connection, this.wallet);
  }

  public async stakeToPublisher(
    stakeAccountPositions: PublicKey,
    publisher: PublicKey,
    amount: bigint,
  ) {
    const instructions = [];

    if (!(await this.hasJoinedDaoLlc(stakeAccountPositions))) {
      instructions.push(
        await this.getJoinDaoLlcInstruction(stakeAccountPositions),
      );
    }

    instructions.push(
      await this.integrityPoolProgram.methods
        .delegate(convertBigIntToBN(amount))
        .accounts({
          owner: this.wallet.publicKey,
          publisher,
          stakeAccountPositions,
        })
        .instruction(),
    );

    return sendTransaction(instructions, this.connection, this.wallet);
  }

  public async getUnlockSchedule(
    stakeAccountPositions: PublicKey,
    includePastPeriods = false,
  ) {
    const stakeAccountMetadataAddress = getStakeAccountMetadataAddress(
      stakeAccountPositions,
    );
    const stakeAccountMetadata =
      await this.stakingProgram.account.stakeAccountMetadataV2.fetch(
        stakeAccountMetadataAddress,
      );
    const vestingSchedule = convertBNToBigInt(stakeAccountMetadata.lock);

    const config = await this.getGlobalConfig();

    if (config.pythTokenListTime === null) {
      throw new Error("Pyth token list time not set in global config");
    }

    return getUnlockSchedule({
      vestingSchedule,
      pythTokenListTime: config.pythTokenListTime,
      includePastPeriods,
    });
  }

  public async getCirculatingSupply() {
    const vestingSchedule: VestingSchedule = {
      periodicVestingAfterListing: {
        initialBalance: 8_500_000_000n * FRACTION_PRECISION_N,
        numPeriods: 4n,
        periodDuration: ONE_YEAR_IN_SECONDS,
      },
    };

    const config = await this.getGlobalConfig();

    if (config.pythTokenListTime === null) {
      throw new Error("Pyth token list time not set in global config");
    }

    const unlockSchedule = getUnlockSchedule({
      vestingSchedule,
      pythTokenListTime: config.pythTokenListTime,
      includePastPeriods: false,
    });

    const totalLocked = unlockSchedule.schedule.reduce(
      (total, unlock) => total + unlock.amount,
      0n,
    );

    const mint = await this.getPythTokenMint();
    return mint.supply - totalLocked;
  }

  async getAdvanceDelegationRecordInstructions(
    stakeAccountPositions: PublicKey,
    payer?: PublicKey,
  ) {
    const poolData = await this.getPoolDataAccount();
    const stakeAccountPositionsData = await this.getStakeAccountPositions(
      stakeAccountPositions,
    );
    const allPublishers = extractPublisherData(poolData);
    const publishers = allPublishers
      .map((publisher) => {
        const positionsWithPublisher =
          stakeAccountPositionsData.data.positions.filter(
            ({ targetWithParameters }) =>
              targetWithParameters.integrityPool?.publisher.equals(
                publisher.pubkey,
              ),
          );

        let lowestEpoch;
        for (const position of positionsWithPublisher) {
          lowestEpoch = bigintMin(position.activationEpoch, lowestEpoch);
        }

        return {
          ...publisher,
          lowestEpoch,
        };
      })
      .filter(({ lowestEpoch }) => lowestEpoch !== undefined);

    const delegationRecords = await Promise.all(
      publishers.map(({ pubkey }) =>
        this.getDelegationRecord(stakeAccountPositions, pubkey),
      ),
    );

    let lowestEpoch: bigint | undefined;
    for (const [index, publisher] of publishers.entries()) {
      const maximum = bigintMax(
        publisher.lowestEpoch,
        delegationRecords[index]?.lastEpoch,
      );
      lowestEpoch = bigintMin(lowestEpoch, maximum);
    }

    const currentEpoch = await getCurrentEpoch(this.connection);

    // Filter out delegationRecord that are up to date
    const filteredPublishers = publishers.filter((_, index) => {
      return !(delegationRecords[index]?.lastEpoch === currentEpoch);
    });

    // anchor does not calculate the correct pda for other programs
    // therefore we need to manually calculate the pdas
    const advanceDelegationRecordInstructions = await Promise.all(
      filteredPublishers.map(({ pubkey, stakeAccount }) =>
        this.integrityPoolProgram.methods
          .advanceDelegationRecord()
          .accountsPartial({
            payer: payer ?? this.wallet.publicKey,
            publisher: pubkey,
            publisherStakeAccountPositions: stakeAccount,
            publisherStakeAccountCustody: stakeAccount
              ? getStakeAccountCustodyAddress(stakeAccount)
              : null, // eslint-disable-line unicorn/no-null
            stakeAccountPositions,
            stakeAccountCustody: getStakeAccountCustodyAddress(
              stakeAccountPositions,
            ),
          })
          .instruction(),
      ),
    );

    const mergePositionsInstruction = await Promise.all(
      publishers.map(({ pubkey }) =>
        this.integrityPoolProgram.methods
          .mergeDelegationPositions()
          .accounts({
            owner: this.wallet.publicKey,
            publisher: pubkey,
            stakeAccountPositions,
          })
          .instruction(),
      ),
    );

    return {
      advanceDelegationRecordInstructions,
      mergePositionsInstruction,
      lowestEpoch,
    };
  }

  public async advanceDelegationRecord(stakeAccountPositions: PublicKey) {
    const instructions = await this.getAdvanceDelegationRecordInstructions(
      stakeAccountPositions,
    );

    return sendTransaction(
      [
        ...instructions.advanceDelegationRecordInstructions,
        ...instructions.mergePositionsInstruction,
      ],
      this.connection,
      this.wallet,
    );
  }

  public async getClaimableRewards(
    stakeAccountPositions: PublicKey,
    simulationPayer?: PublicKey,
  ) {
    const instructions = await this.getAdvanceDelegationRecordInstructions(
      stakeAccountPositions,
      simulationPayer,
    );

    let totalRewards = 0n;

    for (const instruction of instructions.advanceDelegationRecordInstructions) {
      const tx = new Transaction().add(instruction);
      tx.feePayer = simulationPayer ?? this.wallet.publicKey;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const res = await this.connection.simulateTransaction(tx);
      const val = res.value.returnData?.data[0];
      if (val === undefined) {
        continue;
      }
      const buffer = Buffer.from(val, "base64").reverse();
      totalRewards += BigInt("0x" + buffer.toString("hex"));
    }

    return {
      totalRewards,
      expiry:
        instructions.lowestEpoch === undefined
          ? undefined
          : epochToDate(instructions.lowestEpoch + 53n),
    };
  }

  async setPublisherStakeAccount(
    publisher: PublicKey,
    stakeAccountPositions: PublicKey,
    newStakeAccountPositions: PublicKey | undefined,
  ) {
    const instruction = await this.integrityPoolProgram.methods
      .setPublisherStakeAccount()
      .accounts({
        currentStakeAccountPositionsOption: stakeAccountPositions,
        // eslint-disable-next-line unicorn/no-null
        newStakeAccountPositionsOption: newStakeAccountPositions ?? null,
        publisher,
      })
      .instruction();

    await sendTransaction([instruction], this.connection, this.wallet);
    return;
  }

  public async reassignPublisherStakeAccount(
    publisher: PublicKey,
    stakeAccountPositions: PublicKey,
    newStakeAccountPositions: PublicKey,
  ) {
    return this.setPublisherStakeAccount(
      publisher,
      stakeAccountPositions,
      newStakeAccountPositions,
    );
  }

  public async removePublisherStakeAccount(
    publisher: PublicKey,
    stakeAccountPositions: PublicKey,
  ) {
    return this.setPublisherStakeAccount(
      publisher,
      stakeAccountPositions,
      undefined,
    );
  }

  public async getTargetAccount(): Promise<TargetAccount> {
    const targetAccount =
      await this.stakingProgram.account.targetMetadata.fetch(
        getTargetAccountAddress(),
      );
    return convertBNToBigInt(targetAccount);
  }

  /**
   * This returns the current scaling factor between staked tokens and realms voter weight.
   * The formula is n_staked_tokens = scaling_factor * n_voter_weight
   */
  public async getScalingFactor(): Promise<number> {
    const targetAccount = await this.getTargetAccount();
    return Number(targetAccount.locked) / Number(MAX_VOTER_WEIGHT);
  }

  public async getRecoverAccountInstruction(
    stakeAccountPositions: PublicKey,
    governanceAuthority: PublicKey,
  ): Promise<TransactionInstruction> {
    return this.stakingProgram.methods
      .recoverAccount()
      .accountsPartial({
        stakeAccountPositions,
        governanceAuthority,
      })
      .instruction();
  }

  public async getTransferAccountInstruction(
    stakeAccountPositions: PublicKey,
    governanceAuthority: PublicKey,
    newOwner: PublicKey,
  ): Promise<TransactionInstruction> {
    return this.stakingProgram.methods
      .transferAccount()
      .accountsPartial({
        stakeAccountPositions,
        governanceAuthority,
        newOwner,
      })
      .instruction();
  }

  public async getUpdatePoolAuthorityInstruction(
    governanceAuthority: PublicKey,
    poolAuthority: PublicKey,
  ): Promise<TransactionInstruction> {
    return this.stakingProgram.methods
      .updatePoolAuthority(poolAuthority)
      .accounts({
        governanceAuthority,
      })
      .instruction();
  }

  public async getUpdateVoterWeightInstruction(
    stakeAccountPositions: PublicKey,
    action: VoterWeightAction,
    remainingAccount?: PublicKey,
  ) {
    return this.stakingProgram.methods
      .updateVoterWeight(action)
      .accounts({
        stakeAccountPositions,
      })
      .remainingAccounts(
        remainingAccount
          ? [
              {
                pubkey: remainingAccount,
                isWritable: false,
                isSigner: false,
              },
            ]
          : [],
      )
      .instruction();
  }

  public async hasJoinedDaoLlc(
    stakeAccountPositions: PublicKey,
  ): Promise<boolean> {
    const config = await this.getGlobalConfig();
    const stakeAccountMetadataAddress = getStakeAccountMetadataAddress(
      stakeAccountPositions,
    );
    const stakeAccountMetadata =
      await this.stakingProgram.account.stakeAccountMetadataV2.fetch(
        stakeAccountMetadataAddress,
      );

    return (
      JSON.stringify(stakeAccountMetadata.signedAgreementHash) ===
      JSON.stringify(config.agreementHash)
    );
  }

  public async getJoinDaoLlcInstruction(
    stakeAccountPositions: PublicKey,
  ): Promise<TransactionInstruction> {
    const config = await this.getGlobalConfig();
    return this.stakingProgram.methods
      .joinDaoLlc(config.agreementHash)
      .accounts({
        stakeAccountPositions,
      })
      .instruction();
  }

  public async getMainStakeAccount(owner?: PublicKey) {
    const stakeAccountPositions = await this.getAllStakeAccountPositions(owner);
    const currentEpoch = await getCurrentEpoch(this.connection);

    const stakeAccountVotingTokens = await Promise.all(
      stakeAccountPositions.map(async (position) => {
        const stakeAccountPositionsData =
          await this.getStakeAccountPositions(position);
        return {
          stakeAccountPosition: position,
          votingTokens: getVotingTokenAmount(
            stakeAccountPositionsData,
            currentEpoch,
          ),
        };
      }),
    );

    let mainAccount = stakeAccountVotingTokens[0];

    if (mainAccount === undefined) {
      return;
    }

    for (let i = 1; i < stakeAccountVotingTokens.length; i++) {
      const currentAccount = stakeAccountVotingTokens[i];
      if (
        currentAccount !== undefined &&
        currentAccount.votingTokens > mainAccount.votingTokens
      ) {
        mainAccount = currentAccount;
      }
    }

    return mainAccount;
  }

  public async getVoterWeight(owner?: PublicKey) {
    const mainAccount = await this.getMainStakeAccount(owner);

    if (mainAccount === undefined) {
      return 0;
    }

    const targetAccount = await this.getTargetAccount();

    return (mainAccount.votingTokens * MAX_VOTER_WEIGHT) / targetAccount.locked;
  }

  public async getPythTokenMint(): Promise<Mint> {
    const globalConfig = await this.getGlobalConfig();
    return getMint(this.connection, globalConfig.pythTokenMint);
  }

  public async getRewardCustodyAccount(): Promise<Account> {
    const poolConfigAddress = getPoolConfigAddress();
    const config = await this.getGlobalConfig();

    const rewardCustodyAccountAddress = getAssociatedTokenAddressSync(
      config.pythTokenMint,
      poolConfigAddress,
      true,
    );

    return getAccount(this.connection, rewardCustodyAccountAddress);
  }

  /**
   * Return all stake account positions for all owners.  Note that this method
   * is unique in a few ways:
   *
   * 1. It's very, very expensive.  Don't call it if you don't _really_ need it,
   *    and expect it to take a few minutes to respond.
   * 2. Because the full positionData is so large, json parsing it with a
   *    typical json parser would involve buffering to a string that's too large
   *    for node.  So instead we use `stream-json` to parse it as a stream.
   */
  public async getAllStakeAccountPositionsAllOwners(): Promise<
    StakeAccountPositions[]
  > {
    const res = await fetch(this.connection.rpcEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getProgramAccounts",
        params: [
          this.stakingProgram.programId.toBase58(),
          {
            encoding: "base64",
            filters: [
              {
                memcmp: this.stakingProgram.coder.accounts.memcmp(
                  "positionData",
                ) as {
                  offset: number;
                  bytes: string;
                },
              },
            ],
          },
        ],
      }),
    });

    if (res.ok) {
      const { body } = res;
      if (body) {
        const accounts = await new Promise<unknown>((resolve, reject) => {
          const jsonparser = new JSONParser({ paths: ["$.result"] });
          jsonparser.onValue = ({ value }) => {
            resolve(value);
          };
          const parse = async () => {
            const reader = body.getReader();
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            while (true) {
              const res = await reader.read();
              if (res.done) {
                break;
              } else if (
                typeof res.value === "string" ||
                res.value instanceof Uint8Array
              ) {
                jsonparser.write(res.value);
              }
            }
          };

          parse().then(
            () => {
              reject(new EndOfStreamError());
            },
            (error: unknown) => {
              reject(intoError(error));
            },
          );
        });

        return accountSchema
          .parse(accounts)
          .map(({ pubkey, account }) =>
            deserializeStakeAccountPositions(
              pubkey,
              account.data,
              this.stakingProgram.idl,
            ),
          );
      } else {
        throw new NoBodyError();
      }
    } else {
      throw new NotOKError(res);
    }
  }
}

const accountSchema = z.array(
  z.object({
    account: z.object({
      data: z
        .array(z.string())
        .min(1)
        .transform((data) =>
          // Safe because `min(1)` guarantees that `data` is nonempty
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          Buffer.from(data[0]!, "base64"),
        ),
    }),
    pubkey: z.string().transform((value) => new PublicKey(value)),
  }),
);

const intoError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  } else if (typeof error === "string") {
    return new Error(error);
  } else {
    return new UnknownError();
  }
};

class NotOKError extends Error {
  constructor(result: Response) {
    super(`Received a ${result.status.toString()} response for ${result.url}`);
    this.cause = result;
    this.name = "NotOKError";
  }
}

class NoBodyError extends Error {
  constructor() {
    super("Response did not contain a body!");
    this.name = "NoBodyError";
  }
}

class EndOfStreamError extends Error {
  constructor() {
    super("Reached end of stream without finding accounts");
    this.name = "EndOfStreamError";
  }
}

class UnknownError extends Error {
  constructor() {
    super("Unknown error");
    this.name = "UnknownError";
  }
}
