import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { Staking } from "../types/staking";
import * as StakingIdl from "../idl/staking.json";
import * as IntegrityPoolIdl from "../idl/integrity_pool.json";
import { getConfigAddress, getStakeAccountCustodyAddress } from "./pdas";
import { GlobalConfig } from "./staking/types";
import { StakeAccountPositions } from "./staking/accounts";
import { IntegrityPool } from "../types/integrity_pool";
import { Account, getAccount } from "@solana/spl-token";

export type PythStakingClientConfig = {
  connection: Connection;
  wallet: Wallet;
};

export class PythStakingClient {
  connection: Connection;
  wallet: Wallet;
  provider: AnchorProvider;
  stakingProgram: Program<Staking>;
  integrityPoolProgram: Program<IntegrityPool>;

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
  }

  async setGlobalConfig(config: GlobalConfig) {
    return this.stakingProgram.methods.initConfig(config).rpc();
  }

  async getGlobalConfig(): Promise<GlobalConfig> {
    return this.stakingProgram.account.globalConfig.fetch(
      getConfigAddress()[0]
    );
  }

  /** Gets a users stake accounts */
  public async getStakeAccountPositions(
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
    return res.map(
      (account) =>
        new StakeAccountPositions(
          account.pubkey,
          account.account.data,
          this.stakingProgram.idl
        )
    );
  }

  public async getStakeAccountCustody(
    stakeAccountPositions: PublicKey
  ): Promise<Account> {
    return getAccount(
      this.connection,
      getStakeAccountCustodyAddress(stakeAccountPositions)
    );
  }

  public async stakeToGovernance(stakeAccountPositions: PublicKey, amount: BN) {
    this.stakingProgram.methods
      .createPosition(
        {
          voting: {},
        },
        amount
      )
      .accounts({
        stakeAccountPositions,
      })
      .rpc();
  }
}
