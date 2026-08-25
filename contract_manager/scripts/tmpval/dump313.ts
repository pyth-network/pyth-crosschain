import { Wallet } from "@coral-xyz/anchor";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import { getProposalInstructions, MultisigParser } from "@pythnetwork/xc-admin-common";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import SquadsMeshClass from "@sqds/mesh";
const mesh: any = (SquadsMeshClass as any).default ?? SquadsMeshClass;
async function main() {
  const cluster = "mainnet-beta" as any;
  const url = getPythClusterApiUrl(cluster);
  const squad = mesh.endpoint(url, new Wallet(Keypair.generate()));
  const conn = new Connection(url);
  const tx = await squad.getTransaction(new PublicKey("EUWsLWhBScsuKkkwUuyKrXfL9UATuKvAWzLzvQUJEEom"));
  const raw = await getProposalInstructions(squad, tx);
  const parser = MultisigParser.fromCluster(cluster);
  let n = 0;
  for (const ins of raw) {
    n++;
    console.log(`\n===== instruction #${n} =====`);
    console.log("programId:", ins.programId.toBase58());
    console.log("data(hex):", Buffer.from(ins.data).toString("hex"));
    console.log("keys:");
    for (const k of ins.keys) console.log(`   ${k.pubkey.toBase58()}  signer=${k.isSigner} writable=${k.isWritable}`);
    const p: any = parser.parseInstruction({ data: ins.data as Buffer, keys: ins.keys as any, programId: ins.programId });
    console.log("parsed:", p.constructor.name, p.name ?? "", JSON.stringify(p.args ?? p.governanceAction ?? {}, (k, v) => (typeof v === "bigint" ? v.toString() : v)).slice(0, 1500));
  }
  // account owners for context
  for (const a of ["DgpbK8SiypiUHBkBTAunMnwRWF3McGGR4iKxTrTfTXq4","DaWUKXCyXsnzcvLUyeJRWou8KTn7XtadgTsdhJ6RHS7b","CmumsQAU6TvqW2VLFVySBjQYKqKDeUPMBVdrxJ2YoK1","HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ","EGq9aToMraKE6sJhnS6yWrwbS7BeEbZVRvyJGJ15DhUK","rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"]) {
    try { const i = await conn.getAccountInfo(new PublicKey(a)); console.log(`acct ${a} owner=${i?.owner.toBase58()} exec=${i?.executable} len=${i?.data.length}`); } catch (e: any) { console.log(a, "err", e.message); }
  }
}
main();
