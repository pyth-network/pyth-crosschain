import type { Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import type { PythLazerSolanaContract } from "../target/types/pyth_lazer_solana_contract";

describe("pyth-lazer-solana-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .PythLazerSolanaContract as Program<PythLazerSolanaContract>;

  it("Is initialized!", async () => {
    const topAuthorityKeypair = anchor.web3.Keypair.generate();

    const tx = await program.methods
      .initialize(topAuthorityKeypair.publicKey, anchor.web3.PublicKey.unique())
      .rpc();
    console.log("Your transaction signature", tx);

    const trustedSigner1 = anchor.web3.PublicKey.unique();
    const tx2 = await program.methods
      .update(trustedSigner1, new BN(42))
      .accounts({ topAuthority: topAuthorityKeypair.publicKey })
      .signers([topAuthorityKeypair])
      .rpc();
    console.log("Your transaction signature", tx2);
  });
});
