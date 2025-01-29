import * as anchor from "@coral-xyz/anchor";
import { PythLazerSolanaContract } from "../target/types/pyth_lazer_solana_contract";
import * as pythLazerSolanaContractIdl from "../target/idl/pyth_lazer_solana_contract.json";
import yargs from "yargs/yargs";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

const parser = yargs(process.argv.slice(2)).options({
  url: {
    type: "string",
    demandOption: true,
    desc: "RPC URL to use",
  },
  "storage-id": {
    type: "string",
    demandOption: true,
    desc: "Storage account ID to check",
  },
});

async function main() {
  const argv = await parser.argv;

  // Setup anchor provider
  const connection = new anchor.web3.Connection(argv.url);
  const provider = new anchor.AnchorProvider(
    connection,
    new NodeWallet(anchor.web3.Keypair.generate()), // Dummy wallet since we're only reading
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const program: anchor.Program<PythLazerSolanaContract> = new anchor.Program(
    pythLazerSolanaContractIdl as PythLazerSolanaContract,
    provider
  );

  // Fetch and decode storage account
  const storageId = new anchor.web3.PublicKey(argv["storage-id"]);
  const storage = await program.account.storage.fetch(storageId);

  // Print storage info
  console.log("Storage Account Info:");
  console.log("--------------------");
  console.log("Top Authority:", storage.topAuthority.toBase58());
  console.log("Treasury:", storage.treasury.toBase58());
  console.log("\nTrusted Signers:");
  console.log("----------------");

  for (const signer of storage.trustedSigners) {
    if (signer.pubkey.equals(anchor.web3.PublicKey.default)) continue;
    console.log(`\nPublic Key: ${signer.pubkey.toBase58()}`);
    console.log(
      `Expires At: ${new Date(
        signer.expiresAt.toNumber() * 1000
      ).toISOString()}`
    );
    console.log(
      `Active: ${
        signer.expiresAt.toNumber() > Date.now() / 1000 ? "Yes" : "No"
      }`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
