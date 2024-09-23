import { PythStakingClient } from "@pythnetwork/staking-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { type NextRequest } from "next/server";

import { RPC } from "../../../config/server";

type ResponseType = {
  custodyAccount: string;
  actualAmount: number;
  lock: {
    type: string;
    schedule: {
      date: Date;
      amount: number;
    }[];
  };
}[];

const stakingClient = new PythStakingClient({
  connection: new Connection(
    RPC ?? 'https://api.devnet.solana.com',
  ),
});

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner");

  if (owner === null) {
    return Response.json(
      {
        error: "Must provide the 'owner' query parameters",
      },
      {
        status: 400,
      },
    );
  }

  const positions = await stakingClient.getAllStakeAccountPositions(
    new PublicKey(owner),
  );

  const response: ResponseType = await Promise.all(
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

  return Response.json(response);
}
