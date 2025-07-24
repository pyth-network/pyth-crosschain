import * as anchor from "@coral-xyz/anchor";
import { PYTH_LAZER_SOLANA_CONTRACT_IDL, type PythLazerSolanaContract } from "../src";
import yargs from "yargs/yargs";
import { readFileSync } from "fs";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

// This script initializes the program. It should be run once after the program is deployed. Additionally, if the
// top authority be the same as the given keypair and the trusted signer and expiry time are provided, the trusted
// signer will be updated.
//
// Note: the program id is derived from the idl file (pytd...). Run `anchor test` to generate it.
async function main() {
  let argv = await yargs(process.argv.slice(2))
    .options({
      url: { type: "string", demandOption: true },
      "keypair-path": { type: "string", demandOption: true },
      "top-authority": { type: "string", demandOption: true },
      treasury: { type: "string", demandOption: true },
      "trusted-signer": { type: "string", demandOption: false },
      "expiry-time-seconds": { type: "number", demandOption: false },
    })
    .parse();

  const keypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(argv.keypairPath, "ascii"))),
  );

  const topAuthority = new anchor.web3.PublicKey(argv.topAuthority);
  const treasury = new anchor.web3.PublicKey(argv.treasury);

  const wallet = new NodeWallet(keypair);
  const connection = new anchor.web3.Connection(argv.url, {
    commitment: "confirmed",
  });
  const provider = new anchor.AnchorProvider(connection, wallet);

  const program: anchor.Program<PythLazerSolanaContract> = new anchor.Program(
    PYTH_LAZER_SOLANA_CONTRACT_IDL,
    provider,
  );

  const storage = await program.account.storage.all();
  if (storage.length === 0) {
    console.log("Initializing the program");
    await program.methods
      .initialize(topAuthority, treasury)
      .accounts({
        payer: wallet.publicKey,
      })
      .rpc();
  }

  if (
    topAuthority.equals(wallet.publicKey) &&
    argv.trustedSigner &&
    argv.expiryTimeSeconds
  ) {
    console.log("Updating the trusted signer");
    await program.methods
      .update(
        new anchor.web3.PublicKey(argv.trustedSigner),
        new anchor.BN(argv.expiryTimeSeconds),
      )
      .accounts({})
      .rpc();
  }
}

main();
