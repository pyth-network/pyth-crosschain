import {
  AnchorProvider,
  Program,
  Wallet,
  IdlAccounts,
} from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { Staking } from "../types/staking";
import * as StakingIdl from "../idl/staking.json";
import { getConfigAddress } from "./pdas";

export type GlobalConfig = IdlAccounts<Staking>["globalConfig"];

export type PythStakingClientConfig = {
  connection: Connection;
  wallet: Wallet;
};

export class PythStakingClient {
  connection: Connection;
  wallet: Wallet;
  provider: AnchorProvider;
  stakingProgram: Program<Staking>;

  constructor(config: PythStakingClientConfig) {
    this.connection = config.connection;
    this.wallet = config.wallet;
    this.provider = new AnchorProvider(this.connection, this.wallet, {
      skipPreflight: true,
    });
    this.stakingProgram = new Program(StakingIdl as Staking, this.provider);
  }

  async setGlobalConfig(config: GlobalConfig) {
    console.log("config", config);
    let x;
    try {
      console.log("submitting");
      x = await this.stakingProgram.methods.initConfig(config).rpc();
      console.log("submitted", x);
    } catch (e) {
      console.error(e);
    }
    // return this.stakingProgram.methods.initConfig(config).rpc();
  }

  async getGlobalConfig(): Promise<GlobalConfig> {
    return this.stakingProgram.account.globalConfig.fetch(
      getConfigAddress()[0]
    );
  }
}
