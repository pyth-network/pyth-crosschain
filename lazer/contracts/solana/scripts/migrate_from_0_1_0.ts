import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PythLazerSolanaContract } from "../target/types/pyth_lazer_solana_contract";
import * as pythLazerSolanaContractIdl from "../target/idl/pyth_lazer_solana_contract.json";
import yargs from "yargs/yargs";
import { readFileSync } from "fs";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

// This script tops up the storage PDA and calls `migrateFrom010` on the contract.
async function main() {
  let argv = await yargs(process.argv.slice(2))
    .options({
      url: { type: "string", demandOption: true },
      "keypair-path": { type: "string", demandOption: true },
      treasury: { type: "string", demandOption: true },
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

  const storagePdaKey = new anchor.web3.PublicKey(
    "3rdJbqfnagQ4yx9HXJViD4zc4xpiSqmFsKpPuSCQVyQL"
  );
  const storagePdaInfo = await provider.connection.getAccountInfo(
    storagePdaKey
  );
  const newStorageSize = 381;
  if (storagePdaInfo.data.length == newStorageSize) {
    console.log("Already migrated");
    const storage = await program.account.storage.all();
    console.log("storage account: ", storage);
    return;
  }
  const minBalance =
    await provider.connection.getMinimumBalanceForRentExemption(newStorageSize);
  if (storagePdaInfo.lamports < minBalance) {
    console.log("storage PDA needs top-up");
    const transaction = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: storagePdaKey,
        lamports: minBalance - storagePdaInfo.lamports,
      })
    );
    const signature = await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [keypair]
    );
    console.log("signature:", signature);
  } else {
    console.log("storage PDA doesn't need top-up");
  }

  console.log("executing migration");
  const signature2 = await program.methods
    .migrateFrom010(new anchor.web3.PublicKey(argv.treasury))
    .accounts({})
    .rpc();
  console.log("signature:", signature2);
}

main();
