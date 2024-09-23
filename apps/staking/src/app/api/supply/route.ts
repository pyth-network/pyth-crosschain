import { PythStakingClient } from "@pythnetwork/staking-sdk";
import { Connection } from "@solana/web3.js";
import { type NextRequest } from "next/server";

import { RPC } from "../../../config/server";

const stakingClient = new PythStakingClient({
  connection: new Connection(RPC ?? "https://api.mainnet-beta.solana.com"),
});

function validateQ(q: string | null): q is "totalSupply" | "circulatingSupply" {
  return q !== null && ["totalSupply", "circulatingSupply"].includes(q);
}

function getResponse(data: unknown) {
  return Response.json(data, {
    headers: {
      "Cache-Control": "max-age=0, s-maxage=3600",
    },
  });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");

  if (!validateQ(q)) {
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

  if (q === "circulatingSupply") {
    const targetAccount = await stakingClient.getTargetAccount();
    return getResponse(Number(targetAccount.locked));
  } else {
    const pythMint = await stakingClient.getPythTokenMint();
    return getResponse(Number(pythMint.supply));
  }
}
