import * as anchor from "@coral-xyz/anchor";
import { PYTH_LAZER_SOLANA_CONTRACT_IDL, type PythLazerSolanaContract } from "../src/index.js";
import yargs from "yargs/yargs";
import { readFileSync } from "fs";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet.js";

// Add a trusted signer or change its expiry time.
//
// Example:
// pnpm ts-node scripts/add_ecdsa_signer.ts --url 'https://api.testnet.solana.com' \
//    --keypair-path .../key.json --trusted-signer b8d50f0bae75bf6e03c104903d7c3afc4a6596da \
//    --expiry-time-seconds 2057930841
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
    .updateEcdsaSigner(
      [...Buffer.from(argv.trustedSigner, "hex")],
      new anchor.BN(argv.expiryTimeSeconds),
    )
    .accounts({
      payer: wallet.publicKey,
    })
    .rpc();
  console.log("signer updated");
}

main();
