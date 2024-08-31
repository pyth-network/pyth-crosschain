import { PublicKey, type Connection } from "@solana/web3.js";
import {
  type CustomAbortController,
  startValidatorRaw,
} from "./start-validator";
import { PythStakingClient } from "../src/pyth-staking-client";
import { Wallet } from "@coral-xyz/anchor";
import { getConfigAddress } from "../src/pdas";
import type { GlobalConfig } from "../src/types";

describe("Test", () => {
  let connection: Connection;
  let controller: CustomAbortController;
  let wallet: Wallet;
  let pythStakingClient: PythStakingClient;

  beforeAll(async () => {
    ({ connection, controller, wallet } = await startValidatorRaw());
    pythStakingClient = new PythStakingClient({ connection, wallet });
  });

  afterAll(() => {
    return controller.abort();
  });

  test("config", async () => {
    const tmpConfig: GlobalConfig = {
      bump: getConfigAddress()[1],
      governanceAuthority: PublicKey.unique(),
      pythTokenMint: PublicKey.unique(),
      pythGovernanceRealm: PublicKey.unique(),
      unlockingDuration: 100,
      epochDuration: 100n,
      freeze: false,
      pdaAuthority: PublicKey.unique(),
      governanceProgram: PublicKey.unique(),
      pythTokenListTime: null,
      agreementHash: new Array(32).fill(0),
      mockClockTime: 0n,
      poolAuthority: PublicKey.unique(),
    };

    await pythStakingClient.setGlobalConfig(tmpConfig);

    const config = await pythStakingClient.getGlobalConfig();

    expect(config).toEqual(tmpConfig);
  });
});
