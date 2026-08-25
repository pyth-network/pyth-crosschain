import { Wallet } from "@coral-xyz/anchor";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import { getProposalInstructions, MultisigParser, WormholeMultisigInstruction } from "@pythnetwork/xc-admin-common";
import { Keypair, PublicKey } from "@solana/web3.js";
import SquadsMeshClass from "@sqds/mesh";

const mesh: any = (SquadsMeshClass as any).default ?? SquadsMeshClass;

async function main() {
  const cluster = "mainnet-beta" as any;
  const squad = mesh.endpoint(getPythClusterApiUrl(cluster), new Wallet(Keypair.generate()));
  const addr = process.argv[2];
  const transaction = await squad.getTransaction(new PublicKey(addr));
  console.log("=== PROPOSAL", addr, "===");
  console.log("status:", JSON.stringify(transaction.status));
  console.log("ms:", transaction.ms.toBase58(), "creator:", transaction.creator.toBase58(), "txIndex:", transaction.transactionIndex);
  console.log("approved:", transaction.approved.map((k:any)=>k.toBase58()).join(","));
  console.log("rejected:", transaction.rejected.map((k:any)=>k.toBase58()).join(","));
  console.log("cancelled:", transaction.cancelled.map((k:any)=>k.toBase58()).join(","));
  const instructions = await getProposalInstructions(squad, transaction);
  const parser = MultisigParser.fromCluster(cluster);
  const parsed = instructions.map((i:any) => parser.parseInstruction({data: i.data, keys: i.keys, programId: i.programId}));
  let n = 0;
  for (const ins of parsed) {
    n++;
    if (ins instanceof WormholeMultisigInstruction) {
      const ga: any = ins.governanceAction;
      if (!ga) { console.log(`#${n} WormholeMultisig <unparsed governance action>`); continue; }
      const extra: Record<string, unknown> = {};
      for (const k of Object.keys(ga)) {
        if (k === "targetChainId" || k === "action") continue;
        const v = ga[k];
        extra[k] = Buffer.isBuffer(v) ? "0x"+v.toString("hex") : (typeof v === "bigint" ? v.toString() : v);
      }
      console.log(`#${n} ${ga.constructor.name} target=${ga.targetChainId} action=${ga.action} ${JSON.stringify(extra)}`);
    } else {
      console.log(`#${n} OTHER ${ins.constructor.name} ${JSON.stringify({program:(ins as any).program, name:(ins as any).name})}`);
    }
  }
  console.log("TOTAL INSTRUCTIONS:", n);
}
main();
