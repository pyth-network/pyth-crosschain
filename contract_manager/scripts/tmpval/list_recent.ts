import { Wallet } from "@coral-xyz/anchor";
import { getPythClusterApiUrl } from "@pythnetwork/client/lib/cluster";
import { getProposalInstructions, MultisigParser, WormholeMultisigInstruction } from "@pythnetwork/xc-admin-common";
import { Keypair, PublicKey } from "@solana/web3.js";
import SquadsMeshClass from "@sqds/mesh";
const mesh: any = (SquadsMeshClass as any).default ?? SquadsMeshClass;
async function main() {
  const cluster = "mainnet-beta" as any;
  const squad = mesh.endpoint(getPythClusterApiUrl(cluster), new Wallet(Keypair.generate()));
  const msAddr = new PublicKey("FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj");
  const ms = await squad.getMultisig(msAddr);
  console.log("multisig:", msAddr.toBase58(), "threshold:", ms.threshold, "txIndex:", ms.transactionIndex);
  console.log("members:", ms.keys.map((k: any) => k.toBase58()).join("\n         "));
  const from = Number(process.env.FROM ?? Math.max(1, ms.transactionIndex - 15));
  const parser = MultisigParser.fromCluster(cluster);
  for (let i = from; i <= ms.transactionIndex; i++) {
    const idxBuf = Buffer.alloc(4); idxBuf.writeUInt32LE(i);
    const [addr] = PublicKey.findProgramAddressSync(
      [Buffer.from("squad"), msAddr.toBuffer(), idxBuf, Buffer.from("transaction")],
      new PublicKey("SMPLVC8MxZ5Bf5EfF7PaMiTCxoBAcmkbM2vkrvMK8ho"),
    );
    try {
      const tx = await squad.getTransaction(addr);
      const instructions = await getProposalInstructions(squad, tx);
      const parsed = instructions.map((x: any) => parser.parseInstruction({ data: x.data, keys: x.keys, programId: x.programId }));
      const kinds = new Map<string, number>();
      const targets = new Set<string>();
      for (const ins of parsed) {
        if (ins instanceof WormholeMultisigInstruction && ins.governanceAction) {
          const ga: any = ins.governanceAction;
          kinds.set(ga.constructor.name, (kinds.get(ga.constructor.name) ?? 0) + 1);
          targets.add(ga.targetChainId);
        } else kinds.set(ins.constructor.name, (kinds.get(ins.constructor.name) ?? 0) + 1);
      }
      console.log(`#${i} ${addr.toBase58()} status=${Object.keys(tx.status)[0]} approvals=${tx.approved.length} ninstr=${parsed.length} kinds=${JSON.stringify(Object.fromEntries(kinds))}`);
      if (targets.size) console.log(`     targets(${targets.size}): ${[...targets].join(", ")}`);
    } catch (e: any) { console.log(`#${i} ${addr?.toBase58?.()} <err ${e.message}>`); }
  }
}
main();
