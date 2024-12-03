import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PythLazerSolanaContract } from "../target/types/pyth_lazer_solana_contract";
import * as pythLazerSolanaContractIdl from "../target/idl/pyth_lazer_solana_contract.json";
import yargs from "yargs/yargs";
import { readFileSync } from "fs";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

// This script initializes the program and updates the trusted signer
//
// There are some assumptions made in this script:
// 1. The program id is derived from the idl file (pytd...).
// 2. The keypair provided is the top authority keypair
async function main() {
  let argv = await yargs(process.argv.slice(2))
    .options({
      url: { type: "string", demandOption: true },
      "keypair-path": { type: "string", demandOption: true },
      "trusted-signer": { type: "string", demandOption: true },
      "expiry-time-seconds": { type: "number", demandOption: true },
    })
    .parse();

  const keypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(argv.keypairPath, "ascii")))
  );
  const wallet = new NodeWallet(keypair);
  const connection = new anchor.web3.Connection(argv.url, {
    commitment: "confirmed",
  });
  const provider = new anchor.AnchorProvider(connection, wallet);

  const program: Program<PythLazerSolanaContract> = new Program(
    pythLazerSolanaContractIdl as PythLazerSolanaContract,
    provider
  );

  const storage = await program.account.storage.all();
  if (storage.length === 0) {
    console.log("Initializing the program");
    await program.methods
      .initialize(keypair.publicKey, anchor.web3.PublicKey.unique())
      .accounts({
        payer: wallet.publicKey,
      })
      .rpc();
  }

  console.log("Updating the trusted signer");
  await program.methods
    .update(
      new anchor.web3.PublicKey(argv.trustedSigner),
      new anchor.BN(argv.expiryTimeSeconds)
    )
    .accounts({})
    .rpc();
}

main();
