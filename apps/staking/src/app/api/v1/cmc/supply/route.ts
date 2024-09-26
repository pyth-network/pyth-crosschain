import { PythStakingClient } from "@pythnetwork/staking-sdk";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl, Connection } from "@solana/web3.js";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { IS_MAINNET, RPC } from "../../../../../config/server";

const querySchema = z.enum(["totalSupply", "circulatingSupply"]);

export async function GET(req: NextRequest) {
  const stakingClient = new PythStakingClient({
    connection: new Connection(
      RPC ??
        clusterApiUrl(
          IS_MAINNET
            ? WalletAdapterNetwork.Mainnet
            : WalletAdapterNetwork.Devnet,
        ),
      {
        httpHeaders: {
          Origin: req.nextUrl.origin,
          "User-Agent": req.headers.get("User-Agent") ?? "",
        },
      },
    ),
  });

  const query = querySchema.safeParse(req.nextUrl.searchParams.get("q"));
  if (!query.success) {
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
  const q = query.data;

  if (q === "circulatingSupply") {
    const circulatingSupply = await stakingClient.getCirculatingSupply();
    return Response.json(Number(circulatingSupply));
  } else {
    const pythMint = await stakingClient.getPythTokenMint();
    return Response.json(Number(pythMint.supply));
  }
}
