import {
  AccountMeta,
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import SquadsMesh, { DEFAULT_MULTISIG_PROGRAM_ID, getIxPDA } from "@sqds/mesh";
import * as fs from "fs";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";
import {
  getProposals,
  MultisigParser,
  WormholeMultisigInstruction,
} from "xc_admin_common";
import BN from "bn.js";
import { AnchorProvider } from "@project-serum/anchor";
import {
  getPythClusterApiUrl,
  PythCluster,
} from "@pythnetwork/client/lib/cluster";
import {
  deriveFeeCollectorKey,
  getWormholeBridgeData,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wormhole";

export function envOrErr(env: string): string {
  const val = process.env[env];
  if (!val) {
    throw new Error(`environment variable "${env}" must be set`);
  }
  return String(process.env[env]);
}

const CLUSTER: string = envOrErr("CLUSTER");
const COMMITMENT: Commitment =
  (process.env.COMMITMENT as Commitment) ?? "confirmed";
const VAULT: PublicKey = new PublicKey(envOrErr("VAULT"));
const KEYPAIR: Keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(envOrErr("WALLET"), "ascii")))
);

async function run() {
  const squad = new SquadsMesh({
    connection: new Connection(
      getPythClusterApiUrl(CLUSTER as PythCluster),
      COMMITMENT
    ),
    wallet: new NodeWallet(KEYPAIR),
    multisigProgramId: DEFAULT_MULTISIG_PROGRAM_ID,
  });
  const multisigParser = MultisigParser.fromCluster(CLUSTER as PythCluster);

  const wormholeFee = multisigParser.wormholeBridgeAddress
    ? (
        await getWormholeBridgeData(
          squad.connection,
          multisigParser.wormholeBridgeAddress!,
          COMMITMENT
        )
      ).config.fee
    : 0;

  const proposals = await getProposals(squad, VAULT, undefined, "executeReady");
  for (const proposal of proposals) {
    console.log("Trying to execute: ", proposal.publicKey.toBase58());
    // If we have previously cancelled because the proposal was failing, don't attempt
    if (proposal.cancelled.length == 0) {
      for (
        let i = proposal.executedIndex + 1;
        i <= proposal.instructionIndex;
        i++
      ) {
        const instructionPda = getIxPDA(
          proposal.publicKey,
          new BN(i),
          squad.multisigProgramId
        )[0];
        const instruction = await squad.getInstruction(instructionPda);
        const parsedInstruction = multisigParser.parseInstruction({
          programId: instruction.programId,
          data: instruction.data as Buffer,
          keys: instruction.keys as AccountMeta[],
        });
        const transaction = new Transaction();

        if (
          parsedInstruction instanceof WormholeMultisigInstruction &&
          parsedInstruction.name == "postMessage"
        ) {
          transaction.add(
            SystemProgram.transfer({
              lamports: wormholeFee,
              toPubkey: deriveFeeCollectorKey(
                multisigParser.wormholeBridgeAddress!
              ),
              fromPubkey: squad.wallet.publicKey,
            })
          );
        }

        transaction.add(
          await squad.buildExecuteInstruction(
            proposal.publicKey,
            getIxPDA(proposal.publicKey, new BN(i), squad.multisigProgramId)[0]
          )
        );

        try {
          await new AnchorProvider(squad.connection, squad.wallet, {
            commitment: COMMITMENT,
            preflightCommitment: COMMITMENT,
          }).sendAndConfirm(transaction, []);
        } catch (error) {
          // Mark the transaction as cancelled if we failed to run it
          if (error instanceof SendTransactionError) {
            console.log(error);
            await squad.cancelTransaction(proposal.publicKey);
            console.log("Cancelled: ", proposal.publicKey.toBase58());
          }
          break;
        }
      }
    } else {
      console.log("Skipping: ", proposal.publicKey.toBase58());
    }
  }
}

(async () => {
  await run();
})();
