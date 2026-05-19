import { PythStakingClient } from "@pythnetwork/staking-sdk";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { MAINNET_API_RPC } from "../../../../config/server";
import { tokensToString } from "../../../../tokens";

const UnlockScheduleSchema = z.object({
  amount: z.string(),
  date: z.date(),
});

const LockSchema = z.object({
  schedule: z.array(UnlockScheduleSchema),
  type: z.string(),
});

const ResponseSchema = z.array(
  z.object({
    actualAmount: z.string(),
    custodyAccount: z.string(),
    lock: LockSchema,
  }),
);

const isValidPublicKey = (publicKey: string) => {
  try {
    new PublicKey(publicKey);
    return true;
  } catch {
    return false;
  }
};

export async function GET(req: NextRequest) {
  const isMainnet = req.nextUrl.searchParams.get("devnet") !== "true";
  const stakingClient = new PythStakingClient({
    connection: new Connection(
      isMainnet && MAINNET_API_RPC !== undefined
        ? MAINNET_API_RPC
        : clusterApiUrl(WalletAdapterNetwork.Devnet),
    ),
  });

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
        actualAmount: tokensToString(custodyAccount.amount),
        custodyAccount: custodyAccount.address.toBase58(),
        lock: {
          schedule: lock.schedule
            .filter((unlock) => unlock.date > new Date())
            .map((unlock) => ({
              amount: tokensToString(unlock.amount),
              date: unlock.date,
            })),
          type: lock.type,
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
