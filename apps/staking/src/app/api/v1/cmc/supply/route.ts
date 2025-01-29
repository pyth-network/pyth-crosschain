import { PythStakingClient } from "@pythnetwork/staking-sdk";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl, Connection } from "@solana/web3.js";
import { toNumber } from "dnum";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { MAINNET_API_RPC } from "../../../../../config/server";
import { DECIMALS } from "../../../../../tokens";

export async function GET(req: NextRequest) {
  const query = querySchema.safeParse(req.nextUrl.searchParams.get("q"));
  if (query.error) {
    return new Response(
      "The 'q' query parameter must be one of 'totalSupply' or 'circulatingSupply'.",
      { status: 400 },
    );
  } else {
    const isMainnet = req.nextUrl.searchParams.get("devnet") !== "true";
    const asDecimal = req.nextUrl.searchParams.get("as_decimal") === "true";
    const circulating = query.data === "circulatingSupply";
    const supply = await getSupply(isMainnet, circulating);
    return Response.json(formatAmount(asDecimal, supply));
  }
}

const querySchema = z.enum(["totalSupply", "circulatingSupply"]);

const getSupply = async (isMainnet: boolean, circulating: boolean) => {
  const client = isMainnet ? mainnetClient : devnetClient;
  if (circulating) {
    return client.getCirculatingSupply();
  } else {
    const { supply } = await client.getPythTokenMint();
    return supply;
  }
};

const mainnetClient = new PythStakingClient({
  connection: new Connection(
    MAINNET_API_RPC ?? clusterApiUrl(WalletAdapterNetwork.Mainnet),
  ),
});

const devnetClient = new PythStakingClient({
  connection: new Connection(clusterApiUrl(WalletAdapterNetwork.Devnet)),
});

const formatAmount = (asDecimal: boolean, amount: bigint) =>
  asDecimal ? toNumber([amount, DECIMALS]) : Number(amount);
