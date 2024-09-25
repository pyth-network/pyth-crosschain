import { PythStakingClient } from "@pythnetwork/staking-sdk";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { IS_MAINNET, BACKEND_RPC } from "../../../config/server";

const UnlockScheduleSchema = z.object({
  date: z.date(),
  amount: z.number(),
});

const LockSchema = z.object({
  type: z.string(),
  schedule: z.array(UnlockScheduleSchema),
});

const ResponseSchema = z.array(
  z.object({
    custodyAccount: z.string(),
    actualAmount: z.number(),
    lock: LockSchema,
  }),
);

const stakingClient = new PythStakingClient({
  connection: new Connection(
    BACKEND_RPC ??
      clusterApiUrl(
        IS_MAINNET ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet,
      ),
  ),
});

const isValidPublicKey = (publicKey: string) => {
  try {
    new PublicKey(publicKey);
    return true;
  } catch {
    return false;
  }
};

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner");

  if (owner === null || !isValidPublicKey(owner)) {
    return Response.json(
      {
        error:
          "Must provide the 'owner' query parameters as a valid base58 public key",
      },
      {
        status: 400,
      },
    );
  }

  const positions = await stakingClient.getAllStakeAccountPositions(
    new PublicKey(owner),
  );

  const responseRaw = await Promise.all(
    positions.map(async (position) => {
      const custodyAccount =
        await stakingClient.getStakeAccountCustody(position);
      const lock = await stakingClient.getUnlockSchedule(position, true);
      return {
        custodyAccount: custodyAccount.address.toBase58(),
        actualAmount: Number(custodyAccount.amount),
        lock: {
          type: lock.type,
          schedule: lock.schedule.map((unlock) => ({
            date: unlock.date,
            amount: Number(unlock.amount),
          })),
        },
      };
    }),
  );

  const response = ResponseSchema.safeParse(responseRaw);

  return response.success
    ? Response.json(response.data)
    : Response.json(
        {
          error: "Internal server error",
        },
        {
          status: 500,
        },
      );
}
