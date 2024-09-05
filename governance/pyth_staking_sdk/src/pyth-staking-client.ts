import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  sendTransactions,
  TransactionBuilder,
} from "@pythnetwork/solana-utils";
import {
  type Account,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";

import {
  getConfigAddress,
  getPoolConfigAddress,
  getStakeAccountCustodyAddress,
  getStakeAccountMetadataAddress,
} from "./pdas";
import type {
  GlobalConfig,
  PoolConfig,
  PoolDataAccount,
  StakeAccountPositions,
} from "./types";
import { convertBigIntToBN, convertBNToBigInt } from "./utils/bn";
import { deserializeStakeAccountPositions } from "./utils/position";
import { getUnlockSchedule } from "./utils/vesting";
import * as IntegrityPoolIdl from "../idl/integrity-pool.json";
import * as PublisherCapsIdl from "../idl/publisher-caps.json";
import * as StakingIdl from "../idl/staking.json";
import type { IntegrityPool } from "../types/integrity-pool";
import type { PublisherCaps } from "../types/publisher-caps";
import type { Staking } from "../types/staking";

export type PythStakingClientConfig = {
  connection: Connection;
  wallet: AnchorWallet;
};

export class PythStakingClient {
  connection: Connection;
  wallet: AnchorWallet;
  provider: AnchorProvider;
  stakingProgram: Program<Staking>;
  integrityPoolProgram: Program<IntegrityPool>;
  publisherCapsProgram: Program<PublisherCaps>;

  constructor(config: PythStakingClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
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

    const transactions =
      await TransactionBuilder.batchIntoVersionedTransactions(
        this.wallet.publicKey,
        this.provider.connection,
        [
          {
            instruction,
            signers: [],
          },
        ],
        {},
      );

    await sendTransactions(transactions, this.connection, this.wallet);
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
  ): Promise<StakeAccountPositions[]> {
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
    return res.map((account) =>
      deserializeStakeAccountPositions(
        account.pubkey,
        account.account.data,
        this.stakingProgram.idl,
      ),
    );
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
  }): Promise<void> {
    const yAnchor = convertBigIntToBN(y);
    const instruction = await this.integrityPoolProgram.methods
      .initializePool(rewardProgramAuthority, yAnchor)
      .accounts({
        poolData,
      })
      .instruction();

    const transactions =
      await TransactionBuilder.batchIntoVersionedTransactions(
        this.wallet.publicKey,
        this.provider.connection,
        [
          {
            instruction,
            signers: [],
          },
        ],
        {},
      );

    await sendTransactions(transactions, this.connection, this.wallet);
  }

  public async getOwnerPythAtaAccount(): Promise<Account> {
    const globalConfig = await this.getGlobalConfig();
    return getAccount(
      this.connection,
      await getAssociatedTokenAddress(
        globalConfig.pythTokenMint,
        this.wallet.publicKey,
      ),
    );
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

  public async getPublishers(): Promise<
    {
      pubkey: PublicKey;
      stakeAccount: PublicKey | null;
    }[]
  > {
    const poolData = await this.getPoolDataAccount();

    return poolData.publishers
      .map((publisher, index) => ({
        pubkey: publisher,
        stakeAccount:
          poolData.publisherStakeAccounts[index] === undefined ||
          poolData.publisherStakeAccounts[index].equals(PublicKey.default)
            ? null
            : poolData.publisherStakeAccounts[index],
      }))
      .filter(({ pubkey }) => !pubkey.equals(PublicKey.default));
  }

  public async stakeToGovernance(
    stakeAccountPositions: PublicKey,
    amount: bigint,
  ) {
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

    const transactions =
      await TransactionBuilder.batchIntoVersionedTransactions(
        this.wallet.publicKey,
        this.provider.connection,
        [
          {
            instruction,
            signers: [],
          },
        ],
        {},
      );

    await sendTransactions(transactions, this.connection, this.wallet);
  }

  public async depositTokensToStakeAccountCustody(
    stakeAccountPositions: PublicKey,
    amount: bigint,
  ) {
    const globalConfig = await this.getGlobalConfig();
    const mint = globalConfig.pythTokenMint;

    const senderTokenAccount = await getAssociatedTokenAddress(
      mint,
      this.wallet.publicKey,
    );

    const transactions =
      await TransactionBuilder.batchIntoVersionedTransactions(
        this.wallet.publicKey,
        this.provider.connection,
        [
          {
            instruction: createTransferInstruction(
              senderTokenAccount,
              getStakeAccountCustodyAddress(stakeAccountPositions),
              this.wallet.publicKey,
              amount,
            ),
            signers: [],
          },
        ],
        {},
      );

    await sendTransactions(transactions, this.connection, this.wallet);
  }

  public async withdrawTokensFromStakeAccountCustody(
    stakeAccountPositions: PublicKey,
    amount: bigint,
  ) {
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

    const transactions =
      await TransactionBuilder.batchIntoVersionedTransactions(
        this.wallet.publicKey,
        this.provider.connection,
        [
          {
            instruction,
            signers: [],
          },
        ],
        {},
      );

    await sendTransactions(transactions, this.connection, this.wallet);
  }

  public async stakeToPublisher(options: {
    stakeAccountPositions: PublicKey;
    publisher: PublicKey;
    amount: bigint;
  }) {
    const { stakeAccountPositions, publisher, amount } = options;
    const instruction = await this.integrityPoolProgram.methods
      .delegate(convertBigIntToBN(amount))
      .accounts({
        owner: this.wallet.publicKey,
        publisher,
        stakeAccountPositions,
      })
      .instruction();

    const transactions =
      await TransactionBuilder.batchIntoVersionedTransactions(
        this.wallet.publicKey,
        this.provider.connection,
        [
          {
            instruction,
            signers: [],
          },
        ],
        {},
      );

    await sendTransactions(transactions, this.connection, this.wallet);
  }

  public async getUnlockSchedule(options: {
    stakeAccountPositions: PublicKey;
  }) {
    const { stakeAccountPositions } = options;
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

  public async advanceDelegationRecord(options: {
    stakeAccountPositions: PublicKey;
  }) {
    // TODO: optimize to only send transactions for publishers that have positive rewards
    const { stakeAccountPositions } = options;
    const publishers = await this.getPublishers();

    // anchor does not calculate the correct pda for other programs
    // therefore we need to manually calculate the pdas
    const instructions = await Promise.all(
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

    const transactions =
      await TransactionBuilder.batchIntoVersionedTransactions(
        this.wallet.publicKey,
        this.provider.connection,
        instructions.map((instruction) => ({
          instruction,
          signers: [],
        })),
        {},
      );

    await sendTransactions(transactions, this.connection, this.wallet);
  }
}
