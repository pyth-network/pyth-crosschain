import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  AccountType,
  getPythProgramKeyForCluster,
  parseBaseData,
  parsePriceData,
} from "@pythnetwork/client";
import { Connection } from "@solana/web3.js";

import StakeCapsParametersIdl from "./idl/stake-caps-parameters.json" with { type: "json" };
import { getStakeCapsParametersAddress } from "./pdas.js";
import type { StakeCapsParameters } from "./types/stake-caps-parameters.js";
import { convertBNToBigInt } from "./utils/bn.js";
import { DummyWallet } from "./utils/wallet.js";
export class PythnetClient {
  connection: Connection;
  provider: AnchorProvider;
  stakeCapParametersProgram: Program<StakeCapsParameters>;

  constructor(connection: Connection) {
    this.connection = connection;
    this.provider = new AnchorProvider(connection, DummyWallet);
    this.stakeCapParametersProgram = new Program<StakeCapsParameters>(
      StakeCapsParametersIdl as StakeCapsParameters,
      this.provider,
    );
  }

  async getPublisherNumberOfSymbols() {
    const publisherNumberOfSymbols: Record<string, number> = {};
    const pythAccounts = await this.connection.getProgramAccounts(
      getPythProgramKeyForCluster("pythnet"),
    );
    for (const account of pythAccounts) {
      const base = parseBaseData(account.account.data);
      if (base?.type === AccountType.Price) {
        const parsed = parsePriceData(account.account.data);
        for (const priceComponent of parsed.priceComponents) {
          publisherNumberOfSymbols[priceComponent.publisher.toBase58()] =
            (publisherNumberOfSymbols[priceComponent.publisher.toBase58()] ??
              0) + 1;
        }
      }
    }
    return publisherNumberOfSymbols;
  }

  async getStakeCapParameters() {
    const parameters =
      await this.stakeCapParametersProgram.account.parameters.fetch(
        getStakeCapsParametersAddress()[0],
      );
    return convertBNToBigInt(parameters);
  }
}
