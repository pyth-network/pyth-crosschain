import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import Squads from "@sqds/mesh";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet.js";

const RPC = "https://api.mainnet-beta.solana.com";
const conn = new Connection(RPC, "confirmed");

const INTEGRITY_POOL = new PublicKey("pyti8TM4zRVBjmarcgAPmTNNAXYKJv7WVHrkrm6woLN");
const PROPOSAL = new PublicKey("AfHSq7wAe167Dqd3rSpQCnTgxQUeyPRGPS7CJdCp6x6a");
const UPGRADE_MULTISIG = new PublicKey("FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj");
const PRICE_FEED_MULTISIG = new PublicKey("92hQkq8kBgCUcF9yWN8URZB9RTmA4mZpDGtbiAWA74Z8");
const rewardProgramAuthority = new PublicKey("6oXTdojyfDS8m5VtTaYB9xRCxpKGSvKJFndLUPV3V3wT");
const poolConfigOnChain = new PublicKey("BE8Xq1iHSQYKG8CZorZsrTnxyeHKQLzCWm4dYKdFkVEL");

// 1. Derive pool_config PDA
const [poolConfigPda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("pool_config")], INTEGRITY_POOL);
console.log("Derived pool_config PDA :", poolConfigPda.toBase58(), "(bump", bump + ")");
console.log("On-chain poolConfig acct:", poolConfigOnChain.toBase58());
console.log("  match:", poolConfigPda.equals(poolConfigOnChain));

// 2. Decode PoolConfig account (8 disc + poolData32 + rewardProgramAuthority32 + pythTokenMint32 + y8 + slashCustody32)
const info = await conn.getAccountInfo(poolConfigOnChain);
console.log("\nPoolConfig owner program:", info.owner.toBase58());
const d = info.data;
const rewardAuth = new PublicKey(d.subarray(8 + 32, 8 + 64));
const pythTokenMint = new PublicKey(d.subarray(8 + 64, 8 + 96));
console.log("PoolConfig.rewardProgramAuthority:", rewardAuth.toBase58());
console.log("  == withdraw signer 6oXTdojy...:", rewardAuth.equals(rewardProgramAuthority));
console.log("PoolConfig.pythTokenMint         :", pythTokenMint.toBase58());

// 3. Which multisig vault authority == rewardProgramAuthority?
const wallet = new NodeWallet.default(new Keypair());
const squad = Squads.default.endpoint(RPC, wallet);
for (const [name, ms] of [["UPGRADE_MULTISIG(Council)", UPGRADE_MULTISIG], ["PRICE_FEED_MULTISIG", PRICE_FEED_MULTISIG]]) {
  const msAcc = await squad.getMultisig(ms);
  const authPda = await squad.getAuthorityPDA(ms, msAcc.authorityIndex);
  console.log(`\n${name} ${ms.toBase58()} authorityIndex=${msAcc.authorityIndex}`);
  console.log("  vault authority PDA:", authPda.toBase58(), "==signer:", authPda.equals(rewardProgramAuthority));
}

// 4. Which multisig owns the proposal transaction?
const txAcc = await squad.getTransaction(PROPOSAL);
console.log("\nProposal", PROPOSAL.toBase58());
console.log("  belongs to multisig:", txAcc.ms.toBase58());
console.log("  status:", JSON.stringify(txAcc.status), "instructionIndex:", txAcc.instructionIndex, "authorityIndex:", txAcc.authorityIndex);
