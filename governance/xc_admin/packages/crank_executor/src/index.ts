// biome-ignore-all lint/style/noProcessEnv lint/nursery/noUndeclaredEnvVars: Script uses env vars for configuration
import * as fs from "node:fs";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import type { PythCluster } from "@pythnetwork/client/lib/cluster";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import {
  envOrErr,
  executeProposal,
  getProposals,
} from "@pythnetwork/xc-admin-common";
import type { Commitment } from "@solana/web3.js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import SquadsMesh, { DEFAULT_MULTISIG_PROGRAM_ID } from "@sqds/mesh";

const CLUSTER: PythCluster = envOrErr("CLUSTER") as PythCluster;
const VAULT: PublicKey = new PublicKey(envOrErr("VAULT"));
const KEYPAIR: Keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(envOrErr("WALLET"), "ascii"))),
);
const SOLANA_RPC = process.env.SOLANA_RPC;
const COMMITMENT: Commitment =
  (process.env.COMMITMENT as Commitment) ?? "confirmed";
const COMPUTE_UNIT_PRICE_MICROLAMPORTS: number | undefined = process.env
  .COMPUTE_UNIT_PRICE_MICROLAMPORTS
  ? Number(process.env.COMPUTE_UNIT_PRICE_MICROLAMPORTS)
  : undefined;

async function run() {
  const squad = new SquadsMesh({
    connection: new Connection(
      SOLANA_RPC ?? getPythClusterApiUrl(CLUSTER),
      COMMITMENT,
    ),
    multisigProgramId: DEFAULT_MULTISIG_PROGRAM_ID,
    wallet: new NodeWallet(KEYPAIR),
  });

  const proposals = await getProposals(squad, VAULT, undefined, "executeReady");

  for (const proposal of proposals) {
    // If we have previously cancelled because the proposal was failing, don't attempt
    if (proposal.cancelled.length === 0) {
      await executeProposal(proposal, squad, CLUSTER, COMMITMENT, {
        computeUnitPriceMicroLamports: COMPUTE_UNIT_PRICE_MICROLAMPORTS!,
      });
    } else {
    }
  }
}

(async () => {
  try {
    await run();
  } catch (_err) {
    throw new Error("Failed to execute proposals");
  }
})();
