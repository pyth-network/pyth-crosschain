import * as anchor from "@coral-xyz/anchor";
import { PYTH_LAZER_SOLANA_CONTRACT_IDL, type PythLazerSolanaContract } from "../src/index.js";
import yargs from "yargs/yargs";
import { readFileSync } from "fs";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet.js";

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

  await program.methods
    .verifyEcdsaMessage(Buffer.from(argv.message, "hex"))
    .accounts({
      payer: wallet.publicKey,
    })
    .rpc();

  console.log("message is valid");
}

main();
