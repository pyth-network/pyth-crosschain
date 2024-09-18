import * as crypto from "crypto";

import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  getTokenOwnerRecordAddress,
  PROGRAM_VERSION_V2,
  withCreateTokenOwnerRecord,
} from "@solana/spl-governance";
import {
  type Account,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { GOVERNANCE_ADDRESS, POSITIONS_ACCOUNT_SIZE } from "./constants";
import {
  getConfigAddress,
  getDelegationRecordAddress,
  getPoolConfigAddress,
  getStakeAccountCustodyAddress,
  getStakeAccountMetadataAddress,
} from "./pdas";
import {
  PositionState,
  type GlobalConfig,
  type PoolConfig,
  type PoolDataAccount,
  type StakeAccountPositions,
} from "./types";
import { convertBigIntToBN, convertBNToBigInt } from "./utils/bn";
import { epochToDate, getCurrentEpoch } from "./utils/clock";
import { extractPublisherData } from "./utils/pool";
import {
  deserializeStakeAccountPositions,
  getPositionState,
} from "./utils/position";
import { sendTransaction } from "./utils/transaction";
import { getUnlockSchedule } from "./utils/vesting";
import * as IntegrityPoolIdl from "../idl/integrity-pool.json";
import * as PublisherCapsIdl from "../idl/publisher-caps.json";
import * as StakingIdl from "../idl/staking.json";
import type { IntegrityPool } from "../types/integrity-pool";
import type { PublisherCaps } from "../types/publisher-caps";
import type { Staking } from "../types/staking";

export type PythStakingClientConfig = {
  connection: Connection;
  wallet: AnchorWallet | undefined;
};

export class PythStakingClient {
  connection: Connection;
  wallet: AnchorWallet | undefined;
  provider: AnchorProvider;
  stakingProgram: Program<Staking>;
  integrityPoolProgram: Program<IntegrityPool>;
  publisherCapsProgram: Program<PublisherCaps>;

  constructor(config: PythStakingClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;

    // {} as AnchorWallet is a workaround for AnchorProvider requiring a wallet
    this.provider = new AnchorProvider(
      this.connection,
      this.wallet ?? ({} as AnchorWallet),
      {
        skipPreflight: true,
      },
    );
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

  private assertWallet(): asserts this is { wallet: AnchorWallet } {
    if (this.wallet === undefined) {
      throw new Error("Wallet not set");
    }
  }

  async initGlobalConfig(config: GlobalConfig) {
    this.assertWallet();
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
    user: PublicKey,
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
                bytes: user.toBase58(),
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
      .fetch(getDelegationRecordAddress(stakeAccountPositions, publisher))
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
    this.assertWallet();
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
    this.assertWallet();
    const globalConfig = await this.getGlobalConfig();
    return getAccount(
      this.connection,
      await getAssociatedTokenAddress(
        globalConfig.pythTokenMint,
        this.wallet.publicKey,
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
    this.assertWallet();
    const instruction = await this.stakingProgram.methods
      .createPosition(
        {
          voting: {},
        },
        new BN(amount.toString()),
      )
      .accounts({
        stakeAccountPositions,
      })
      .instruction();

    return sendTransaction([instruction], this.connection, this.wallet);
  }

  public async unstakeFromGovernance(
    stakeAccountPositions: PublicKey,
    positionState: PositionState.LOCKED | PositionState.LOCKING,
    amount: bigint,
  ) {
    this.assertWallet();
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
    this.assertWallet();
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

  public async hasGovernanceRecord(config: GlobalConfig): Promise<boolean> {
    this.assertWallet();
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
    this.assertWallet();
    const globalConfig = await this.getGlobalConfig();

    const senderTokenAccount = await getAssociatedTokenAddress(
      globalConfig.pythTokenMint,
      this.wallet.publicKey,
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
    this.assertWallet();
    const globalConfig = await this.getGlobalConfig();
    const mint = globalConfig.pythTokenMint;

    const senderTokenAccount = await getAssociatedTokenAddress(
      mint,
      this.wallet.publicKey,
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
    this.assertWallet();
    const globalConfig = await this.getGlobalConfig();
    const mint = globalConfig.pythTokenMint;

    const receiverTokenAccount = await getAssociatedTokenAddress(
      mint,
      this.wallet.publicKey,
    );

    const instruction = await this.stakingProgram.methods
      .withdrawStake(new BN(amount.toString()))
      .accounts({
        destination: receiverTokenAccount,
        stakeAccountPositions,
      })
      .instruction();

    return sendTransaction([instruction], this.connection, this.wallet);
  }

  public async stakeToPublisher(
    stakeAccountPositions: PublicKey,
    publisher: PublicKey,
    amount: bigint,
  ) {
    this.assertWallet();
    const instruction = await this.integrityPoolProgram.methods
      .delegate(convertBigIntToBN(amount))
      .accounts({
        owner: this.wallet.publicKey,
        publisher,
        stakeAccountPositions,
      })
      .instruction();

    return sendTransaction([instruction], this.connection, this.wallet);
  }

  public async getUnlockSchedule(stakeAccountPositions: PublicKey) {
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
    });
  }

  async getAdvanceDelegationRecordInstructions(
    stakeAccountPositions: PublicKey,
  ) {
    this.assertWallet();
    const poolData = await this.getPoolDataAccount();
    const stakeAccountPositionsData = await this.getStakeAccountPositions(
      stakeAccountPositions,
    );
    const allPublishers = extractPublisherData(poolData);
    const publishers = allPublishers.filter(({ pubkey }) =>
      stakeAccountPositionsData.data.positions.some(
        ({ targetWithParameters }) =>
          targetWithParameters.integrityPool?.publisher.equals(pubkey),
      ),
    );

    // anchor does not calculate the correct pda for other programs
    // therefore we need to manually calculate the pdas
    const advanceDelegationRecordInstructions = await Promise.all(
      publishers.map(({ pubkey, stakeAccount }) =>
        this.integrityPoolProgram.methods
          .advanceDelegationRecord()
          .accountsPartial({
            payer: this.wallet.publicKey,
            publisher: pubkey,
            publisherStakeAccountPositions: stakeAccount,
            publisherStakeAccountCustody: stakeAccount
              ? getStakeAccountCustodyAddress(stakeAccount)
              : null,
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
      publishers,
    };
  }

  public async advanceDelegationRecord(stakeAccountPositions: PublicKey) {
    this.assertWallet();
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

  public async getClaimableRewards(stakeAccountPositions: PublicKey) {
    this.assertWallet();
    const instructions = await this.getAdvanceDelegationRecordInstructions(
      stakeAccountPositions,
    );

    let totalRewards = 0n;

    for (const instruction of instructions.advanceDelegationRecordInstructions) {
      const tx = new Transaction().add(instruction);
      tx.feePayer = this.wallet.publicKey;
      const res = await this.connection.simulateTransaction(tx);
      const val = res.value.returnData?.data[0];
      if (val === undefined) {
        continue;
      }
      const buffer = Buffer.from(val, "base64").reverse();
      totalRewards += BigInt("0x" + buffer.toString("hex"));
    }

    const delegationRecords = await Promise.allSettled(
      instructions.publishers.map(({ pubkey }) =>
        this.getDelegationRecord(stakeAccountPositions, pubkey),
      ),
    );

    let lowestEpoch: bigint | undefined;
    for (const record of delegationRecords) {
      if (record.status === "fulfilled") {
        const { lastEpoch } = record.value;
        if (lowestEpoch === undefined || lastEpoch < lowestEpoch) {
          lowestEpoch = lastEpoch;
        }
      }
    }

    return {
      totalRewards,
      expiry:
        lowestEpoch === undefined ? undefined : epochToDate(lowestEpoch + 52n),
    };
  }

  async setPublisherStakeAccount(
    publisher: PublicKey,
    stakeAccountPositions: PublicKey,
    newStakeAccountPositions: PublicKey | undefined,
  ) {
    this.assertWallet();
    const instruction = await this.integrityPoolProgram.methods
      .setPublisherStakeAccount()
      .accounts({
        currentStakeAccountPositionsOption: stakeAccountPositions,
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
}
