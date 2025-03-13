import { Commitment, Connection, Keypair, PublicKey } from "@solana/web3.js";
import SquadsMesh, { DEFAULT_MULTISIG_PROGRAM_ID } from "@sqds/mesh";
import * as fs from "fs";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import {
  envOrErr,
  executeProposal,
  getProposals,
} from "@pythnetwork/xc-admin-common";
import {
  getPythClusterApiUrl,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";

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
    wallet: new NodeWallet(KEYPAIR),
    multisigProgramId: DEFAULT_MULTISIG_PROGRAM_ID,
  });

  const proposals = await getProposals(squad, VAULT, undefined, "executeReady");

  for (const proposal of proposals) {
    console.log("Trying to execute: ", proposal.publicKey.toBase58());
    // If we have previously cancelled because the proposal was failing, don't attempt
    if (proposal.cancelled.length == 0) {
      await executeProposal(proposal, squad, CLUSTER, COMMITMENT, {
        computeUnitPriceMicroLamports: COMPUTE_UNIT_PRICE_MICROLAMPORTS,
      });
    } else {
      console.log("Skipping: ", proposal.publicKey.toBase58());
    }
  }
}

(async () => {
  try {
    await run();
  } catch (err) {
    console.error(err);
    throw new Error();
  }
})();
