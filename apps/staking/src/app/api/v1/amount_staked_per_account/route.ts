import type { PositionState } from "@pythnetwork/staking-sdk";
import {
  PythStakingClient,
  summarizeAccountPositions,
  getCurrentEpoch,
} from "@pythnetwork/staking-sdk";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl, Connection } from "@solana/web3.js";

import {
  AMOUNT_STAKED_PER_ACCOUNT_SECRET,
  MAINNET_API_RPC,
} from "../../../../config/server";

export const maxDuration = 800;

export const GET = async (req: Request) => {
  if (
    AMOUNT_STAKED_PER_ACCOUNT_SECRET === undefined ||
    req.headers.get("authorization") ===
      `Bearer ${AMOUNT_STAKED_PER_ACCOUNT_SECRET}`
  ) {
    const [accounts, epoch] = await Promise.all([
      client.getAllStakeAccountPositionsAllOwners(),
      getCurrentEpoch(client.connection),
    ]);
    return Response.json(
      accounts.map((account) => {
        const summary = summarizeAccountPositions(account, epoch);
        return [
          account.data.owner,
          {
            voting: stringifySummaryValues(summary.voting),
            integrityPool: stringifySummaryValues(summary.integrityPool),
          },
        ];
      }),
    );
  } else {
    return new Response("Unauthorized", { status: 400 });
  }
};

const stringifySummaryValues = (values: Record<PositionState, bigint>) =>
  Object.fromEntries(
    Object.entries(values).map(([state, value]) => [state, value.toString()]),
  );

const client = new PythStakingClient({
  connection: new Connection(
    MAINNET_API_RPC ?? clusterApiUrl(WalletAdapterNetwork.Mainnet),
  ),
});
