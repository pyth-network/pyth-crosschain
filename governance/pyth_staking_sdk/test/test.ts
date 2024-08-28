import { PublicKey, type Connection } from "@solana/web3.js";
import {
  type CustomAbortController,
  startValidatorRaw,
} from "./start-validator";
import { GlobalConfig, PythStakingClient } from "../src/pyth-staking-client";
import { BN, Wallet } from "@coral-xyz/anchor";
import { getConfigAddress } from "../src/pdas";

describe("Test", () => {
  let connection: Connection;
  let controller: CustomAbortController;
  let wallet: Wallet;
  let pythStakingClient: PythStakingClient;

  beforeAll(async () => {
    console.log("startValidatorRaw");
    ({ connection, controller, wallet } = await startValidatorRaw());
    console.log("PythStakingClient");
    pythStakingClient = new PythStakingClient({ connection, wallet });
    console.log("done");
  });

  afterAll(() => {
    return controller.abort();
  });

  test("config", async () => {
    console.log("config");
    const tmpConfig: GlobalConfig = {
      agreementHash: new Array(32),
      bump: getConfigAddress()[1],
      epochDuration: new BN(100),
      freeze: false,
      governanceAuthority: PublicKey.unique(),
      governanceProgram: PublicKey.unique(),
      mockClockTime: new BN(0),
      pdaAuthority: PublicKey.unique(),
      poolAuthority: PublicKey.unique(),
      pythGovernanceRealm: PublicKey.unique(),
      pythTokenListTime: new BN(0),
      pythTokenMint: PublicKey.unique(),
      unlockingDuration: 100,
    };

    // await pythStakingClient.setGlobalConfig(tmpConfig);

    // const config = await pythStakingClient.getGlobalConfig();

    // expect(config).toEqual(tmpConfig);
  });
});
