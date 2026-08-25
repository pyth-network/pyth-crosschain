import { Wallet } from "@coral-xyz/anchor";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import { getProposalInstructions, MultisigParser, WormholeMultisigInstruction } from "@pythnetwork/xc-admin-common";
import { Keypair, PublicKey } from "@solana/web3.js";
import SquadsMeshClass from "@sqds/mesh";
import { writeFileSync } from "node:fs";
const mesh: any = (SquadsMeshClass as any).default ?? SquadsMeshClass;
async function main() {
  const cluster = "mainnet-beta" as any;
  const squad = mesh.endpoint(getPythClusterApiUrl(cluster), new Wallet(Keypair.generate()));
  const out: any[] = [];
  for (const addr of process.argv.slice(2)) {
    const transaction = await squad.getTransaction(new PublicKey(addr));
    const instructions = await getProposalInstructions(squad, transaction);
    const parser = MultisigParser.fromCluster(cluster);
    const parsed = instructions.map((i: any) => parser.parseInstruction({ data: i.data, keys: i.keys, programId: i.programId }));
    const items = parsed.map((ins: any, idx: number) => {
      if (ins instanceof WormholeMultisigInstruction && ins.governanceAction) {
        const ga: any = ins.governanceAction;
        const o: any = { i: idx + 1, kind: ga.constructor.name, target: ga.targetChainId };
        for (const k of Object.keys(ga)) {
          const v = ga[k];
          o[k] = Buffer.isBuffer(v) ? "0x" + v.toString("hex") : typeof v === "bigint" ? v.toString() : v;
        }
        return o;
      }
      return { i: idx + 1, kind: "RAW_" + ins.constructor.name, raw: JSON.parse(JSON.stringify(ins)) };
    });
    out.push({ proposal: addr, status: transaction.status, txIndex: transaction.transactionIndex, instructions: items });
  }
  writeFileSync("/tmp/proposals.json", JSON.stringify(out, null, 2));
  console.log("wrote /tmp/proposals.json");
}
main();
