import { PythStakingClient } from "@pythnetwork/staking-sdk";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl, Connection } from "@solana/web3.js";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { IS_MAINNET, RPC } from "../../../config/server";

const stakingClient = new PythStakingClient({
  connection: new Connection(
    RPC ??
      clusterApiUrl(
        IS_MAINNET ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet,
      ),
  ),
});

const querySchema = z.enum(["totalSupply", "circulatingSupply"]);

export async function GET(req: NextRequest) {
  try {
    const q = querySchema.parse(req.nextUrl.searchParams.get("q"));

    if (q === "circulatingSupply") {
      const circulatingSupply = await stakingClient.getCirculatingSupply();
      return Response.json(Number(circulatingSupply));
    } else {
      const pythMint = await stakingClient.getPythTokenMint();
      return Response.json(Number(pythMint.supply));
    }
  } catch {
    return Response.json(
      {
        error:
          "The 'q' query parameter must be one of 'totalSupply' or 'circulatingSupply'.",
      },
      {
        status: 400,
      },
    );
  }
}
