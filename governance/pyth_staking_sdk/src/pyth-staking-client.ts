import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { type Staking } from "../types/staking";
import * as StakingIdl from "../idl/staking.json";
import * as IntegrityPoolIdl from "../idl/integrity_pool.json";
import * as PublisherCapsIdl from "../idl/publisher_caps.json";
import {
  getConfigAddress,
  getPoolConfigAddress,
  getStakeAccountCustodyAddress,
  getStakeAccountMetadataAddress,
} from "./pdas";
import type { GlobalConfig, PoolConfig, PoolDataAccount } from "./types";
import {
  type StakeAccountPositions,
  StakeAccountPositionsAnchor,
} from "./staking/accounts";
import type { IntegrityPool } from "../types/integrity_pool";
import {
  type Account,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  sendTransactions,
  TransactionBuilder,
} from "@pythnetwork/solana-utils";
import { convertBigIntToBN, convertBNToBigInt } from "./utils/bn";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import type { PublisherCaps } from "../types/publisher_caps";
import { getUnlockSchedule } from "./utils/vesting";

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
      this.provider
    );
    this.publisherCapsProgram = new Program(
      PublisherCapsIdl as PublisherCaps,
      this.provider
    );
  }

  async setGlobalConfig(config: GlobalConfig) {
    const globalConfigAnchor = convertBigIntToBN(config);
    return this.stakingProgram.methods.initConfig(globalConfigAnchor).rpc();
  }

  async getGlobalConfig(): Promise<GlobalConfig> {
    const globalConfigAnchor =
      await this.stakingProgram.account.globalConfig.fetch(
        getConfigAddress()[0]
      );
    return convertBNToBigInt(globalConfigAnchor);
  }

  /** Gets a users stake accounts */
  public async getAllStakeAccountPositions(
    user: PublicKey
  ): Promise<StakeAccountPositions[]> {
    const res =
      await this.stakingProgram.provider.connection.getProgramAccounts(
        this.stakingProgram.programId,
        {
          encoding: "base64",
          filters: [
            {
              memcmp: this.stakingProgram.coder.accounts.memcmp("positionData"),
            },
            {
              memcmp: {
                offset: 8,
                bytes: user.toBase58(),
              },
            },
          ],
        }
      );
    return res.map((account) => {
      const stakeAccountPositionsAnchor = new StakeAccountPositionsAnchor(
        account.pubkey,
        account.account.data,
        this.stakingProgram.idl
      );
      return stakeAccountPositionsAnchor.toStakeAccountPositions();
    });
  }

  public async getStakeAccountPositions(
    stakeAccountPositions: PublicKey
  ): Promise<StakeAccountPositions> {
    const account =
      await this.stakingProgram.provider.connection.getAccountInfo(
        stakeAccountPositions
      );
    const stakeAccountPositionsAnchor = new StakeAccountPositionsAnchor(
      stakeAccountPositions,
      account!.data,
      this.stakingProgram.idl
    );
    return stakeAccountPositionsAnchor.toStakeAccountPositions();
  }

  public async getStakeAccountCustody(
    stakeAccountPositions: PublicKey
  ): Promise<Account> {
    return getAccount(
      this.connection,
      getStakeAccountCustodyAddress(stakeAccountPositions)
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
    const config = await this.getGlobalConfig();
    await this.integrityPoolProgram.methods
      .initializePool(rewardProgramAuthority, config.pythTokenMint, yAnchor)
      .accounts({
        poolData,
      })
      .rpc();
  }

  public async getOwnerPythATAAccount(): Promise<Account> {
    const globalConfig = await this.getGlobalConfig();
    return getAccount(
      this.connection,
      await getAssociatedTokenAddress(
        globalConfig.pythTokenMint,
        this.wallet.publicKey
      )
    );
  }

  public async getPoolConfigAccount(): Promise<PoolConfig> {
    const poolConfigAnchor =
      await this.integrityPoolProgram.account.poolConfig.fetch(
        getPoolConfigAddress()
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
        stakeAccount: poolData.publisherStakeAccounts[index]?.equals(
          PublicKey.default
        )
          ? null
          : poolData.publisherStakeAccounts[index]!,
      }))
      .filter(({ pubkey }) => pubkey && !pubkey.equals(PublicKey.default));
  }

  public async stakeToGovernance(
    stakeAccountPositions: PublicKey,
    amount: bigint
  ) {
    this.stakingProgram.methods
      .createPosition(
        {
          voting: {},
        },
        new BN(amount.toString())
      )
      .accounts({
        stakeAccountPositions,
      })
      .rpc();
  }

  public async depositTokensToStakeAccountCustody(
    stakeAccountPositions: PublicKey,
    amount: bigint
  ) {
    const globalConfig = await this.getGlobalConfig();
    const mint = globalConfig.pythTokenMint;

    const senderTokenAccount = await getAssociatedTokenAddress(
      mint,
      this.wallet.publicKey
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
              amount
            ),
            signers: [],
          },
        ],
        {}
      );

    await sendTransactions(transactions, this.connection, this.wallet);
  }

  public async withdrawTokensFromStakeAccountCustody(
    stakeAccountPositions: PublicKey,
    amount: bigint
  ) {
    const globalConfig = await this.getGlobalConfig();
    const mint = globalConfig.pythTokenMint;

    const receiverTokenAccount = await getAssociatedTokenAddress(
      mint,
      this.wallet.publicKey
    );

    this.stakingProgram.methods
      .withdrawStake(new BN(amount.toString()))
      .accounts({
        destination: receiverTokenAccount,
        stakeAccountPositions,
      })
      .rpc();
  }

  public async stakeToPublisher(options: {
    stakeAccountPositions: PublicKey;
    publisher: PublicKey;
    amount: bigint;
  }) {
    const { stakeAccountPositions, publisher, amount } = options;
    this.integrityPoolProgram.methods
      .delegate(new BN(amount.toString()))
      .accounts({
        owner: this.wallet.publicKey,
        publisher,
        stakeAccountPositions,
      })
      .rpc();
  }

  public async getUnlockSchedule(options: {
    stakeAccountPositions: PublicKey;
  }) {
    const { stakeAccountPositions } = options;
    const stakeAccountMetadataAddress = getStakeAccountMetadataAddress(
      stakeAccountPositions
    );
    const stakeAccountMetadata =
      await this.stakingProgram.account.stakeAccountMetadataV2.fetch(
        stakeAccountMetadataAddress
      );
    const vestingSchedule = convertBNToBigInt(stakeAccountMetadata.lock);

    const config = await this.getGlobalConfig();

    return getUnlockSchedule({
      vestingSchedule,
      pythTokenListTime: config.pythTokenListTime!,
    });
  }

  public async advanceDelegationRecord(options: {
    stakeAccountPositions: PublicKey;
  }) {
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
              stakeAccountPositions
            ),
          })
          .instruction()
      )
    );

    const transactions =
      await TransactionBuilder.batchIntoVersionedTransactions(
        this.wallet.publicKey,
        this.provider.connection,
        instructions.slice(0, 1).map((instruction) => ({
          instruction,
          signers: [],
        })),
        {}
      );

    await sendTransactions(transactions, this.connection, this.wallet);
  }
}
