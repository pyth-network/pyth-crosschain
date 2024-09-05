import { Wallet } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  type Connection,
} from "@solana/web3.js";

import {
  type CustomAbortController,
  startValidatorRaw,
} from "./start-validator";
import { getCurrentEpoch } from "../src";
import { getConfigAddress } from "../src/pdas";
import { PythStakingClient } from "../src/pyth-staking-client";
import type { GlobalConfig } from "../src/types";

describe("Test", () => {
  let connection: Connection;
  let controller: CustomAbortController;
  let wallet: Wallet;
  let pythStakingClient: PythStakingClient;
  let rewardProgramAuthority: Keypair;
  let poolData: Keypair;
  let config: GlobalConfig;

  beforeAll(async () => {
    ({ connection, controller, wallet } = await startValidatorRaw());
    pythStakingClient = new PythStakingClient({ connection, wallet });
    rewardProgramAuthority = Keypair.generate();
    poolData = Keypair.generate();
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
      removedUnlockingDuration: 0,
      epochDuration: 100n,
      freeze: false,
      pdaAuthority: PublicKey.unique(),
      governanceProgram: PublicKey.unique(),
      pythTokenListTime: null,
      agreementHash: Array.from<number>({ length: 32 }).fill(0),
      mockClockTime: 0n,
      poolAuthority: PublicKey.unique(),
    };

    await pythStakingClient.initGlobalConfig(tmpConfig);

    config = await pythStakingClient.getGlobalConfig();

    expect(config).toEqual(tmpConfig);
  });

  test("initialize pool", async () => {
    const poolDataSpace = 2 * 1024 * 1024;
    const balance =
      await connection.getMinimumBalanceForRentExemption(poolDataSpace);

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: poolData.publicKey,
        lamports: balance,
        space: poolDataSpace,
        programId: pythStakingClient.integrityPoolProgram.programId,
      }),
    );

    await sendAndConfirmTransaction(connection, transaction, [
      wallet.payer,
      poolData,
    ]);

    await pythStakingClient.initializePool({
      rewardProgramAuthority: rewardProgramAuthority.publicKey,
      y: 100n,
      poolData: poolData.publicKey,
    });

    const poolConfig = await pythStakingClient.getPoolConfigAccount();

    expect(poolConfig).toEqual({
      poolData: poolData.publicKey,
      rewardProgramAuthority: rewardProgramAuthority.publicKey,
      pythTokenMint: config.pythTokenMint,
      y: 100n,
    });

    const poolDataAccount = await pythStakingClient.getPoolDataAccount();

    expect(poolDataAccount).toEqual({
      lastUpdatedEpoch: (await getCurrentEpoch(connection)) - 1n,
      claimableRewards: 0n,
      publishers: Array.from({ length: 1024 }).fill(PublicKey.default),
      delState: Array.from({ length: 1024 }).fill({
        totalDelegation: 0n,
        deltaDelegation: 0n,
      }),
      selfDelState: Array.from({ length: 1024 }).fill({
        totalDelegation: 0n,
        deltaDelegation: 0n,
      }),
      publisherStakeAccounts: Array.from({ length: 1024 }).fill(
        PublicKey.default,
      ),
      events: Array.from({ length: 52 }).fill({
        epoch: 0n,
        y: 0n,
        extraSpace: Array.from({ length: 7 }).fill(0n),
        eventData: Array.from({ length: 1024 }).fill({
          selfRewardRatio: 0n,
          otherRewardRatio: 0n,
          delegationFee: 0n,
        }),
      }),
      numEvents: 0n,
      numSlashEvents: Array.from({ length: 1024 }).fill(0n),
      delegationFees: Array.from({ length: 1024 }).fill(0n),
    });
  });
});
