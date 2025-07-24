import * as anchor from "@coral-xyz/anchor";
import { PYTH_LAZER_SOLANA_CONTRACT_IDL, type PythLazerSolanaContract } from "../src";
import yargs from "yargs/yargs";
import { readFileSync } from "fs";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { createEd25519Instruction } from "../src/ed25519";
import {
  sendAndConfirmTransaction,
  SendTransactionError,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
} from "@solana/web3.js";

async function main() {
  let argv = await yargs(process.argv.slice(2))
    .options({
      url: { type: "string", demandOption: true },
      "keypair-path": { type: "string", demandOption: true },
      message: { type: "string", demandOption: true },
    })
    .parse();

  const keypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(argv.keypairPath, "ascii"))),
  );

  const wallet = new NodeWallet(keypair);
  const connection = new anchor.web3.Connection(argv.url, {
    commitment: "confirmed",
  });
  const provider = new anchor.AnchorProvider(connection, wallet);

  const program: anchor.Program<PythLazerSolanaContract> = new anchor.Program(
    PYTH_LAZER_SOLANA_CONTRACT_IDL,
    provider,
  );

  const instructionMessage = Buffer.from(argv.message, "hex");
  const ed25519Instruction = createEd25519Instruction(
    instructionMessage,
    1,
    12,
  );
  const lazerInstruction = await program.methods
    .verifyMessage(instructionMessage, 0, 0)
    .accounts({
      payer: wallet.publicKey,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();

  const transaction = new Transaction().add(
    ed25519Instruction,
    lazerInstruction,
  );
  console.log("transaction:", transaction);

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.payer],
      {
        skipPreflight: true,
      },
    );
    console.log("Transaction confirmed with signature:", signature);
  } catch (e) {
    console.log("error", e);
    if (e instanceof SendTransactionError) {
      console.log(await e.getLogs(connection));
    }
  }
}

main();
