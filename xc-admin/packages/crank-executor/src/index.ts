import {
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import SquadsMesh, { DEFAULT_MULTISIG_PROGRAM_ID, getIxPDA } from "@sqds/mesh";
import * as fs from "fs";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import { getProposals } from "xc-admin-common";
import BN from "bn.js";
import { AnchorProvider } from "@project-serum/anchor";

export function envOrErr(env: string): string {
  const val = process.env[env];
  if (!val) {
    throw new Error(`environment variable "${env}" must be set`);
  }
  return String(process.env[env]);
}

const SOLANA_CLUSTER_URL: string = envOrErr("SOLANA_RPC_URL");
const SOLANA_CONNECTION_COMMITMENT: Commitment =
  (process.env.SOLANA_CONNECTION_COMMITMENT as Commitment) ?? "confirmed";
const MULTISIG_VAULT: PublicKey = new PublicKey(envOrErr("SOLANA_RPC_URL"));
const KEYPAIR: Keypair = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync(envOrErr("KEYPAIR_PATH"), "ascii"))
  )
);

async function run() {
  const squad = new SquadsMesh({
    connection: new Connection(
      SOLANA_CLUSTER_URL,
      SOLANA_CONNECTION_COMMITMENT
    ),
    wallet: new NodeWallet(KEYPAIR),
    multisigProgramId: DEFAULT_MULTISIG_PROGRAM_ID,
  });
  const proposals = await getProposals(
    squad,
    MULTISIG_VAULT,
    undefined,
    "executeReady"
  );

  for (const proposal of proposals) {
    // If we have previously cancelled because the proposal was failing, don't attempt
    if (proposal.cancelled.length == 0) {
      for (let i = proposal.executedIndex; i < proposal.instructionIndex; i++) {
        const transaction = new Transaction().add(
          await squad.buildExecuteInstruction(
            proposal.publicKey,
            getIxPDA(proposal.publicKey, new BN(i), squad.multisigProgramId)[0]
          )
        );

        try {
          await new AnchorProvider(squad.connection, squad.wallet, {
            commitment: SOLANA_CONNECTION_COMMITMENT,
            preflightCommitment: SOLANA_CONNECTION_COMMITMENT,
          }).sendAndConfirm(transaction, [KEYPAIR]);
        } catch (error) {
          // Mark the transaction as cancelled if we failed to run it
          await squad.cancelTransaction(proposal.publicKey);
          break;
        }
      }
    }
  }
}

(async () => {
  await run();
})();
