import Web3 from "web3";
const K = Web3.utils.keccak256;
async function main() {
  const url = "https://pyth.dourolabs.app/hermes/v2/updates/price/latest?ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43&encoding=hex";
  const counts = new Map<number, number>();
  const combos = new Map<string, number>();
  const N = 40;
  for (let i = 0; i < N; i++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.PYTH_API_KEY}` } });
    const j: any = await r.json();
    const buf = Buffer.from(j.binary.data[0], "hex");
    let o = 4 + 2; const tl = buf[o++]; o += tl; o++; const vl = buf.readUInt16BE(o); o += 2;
    const vaa = buf.subarray(o, o + vl);
    let p = 1 + 4; const n = vaa[p++];
    const idxs: number[] = [];
    for (let s = 0; s < n; s++) { idxs.push(vaa[p]); p += 66; }
    for (const x of idxs) counts.set(x, (counts.get(x) ?? 0) + 1);
    combos.set(idxs.join(","), (combos.get(idxs.join(",")) ?? 0) + 1);
    await new Promise((res) => setTimeout(res, 250));
  }
  console.log(`over ${N} live VAAs from the upgraded Hermes:`);
  console.log("signature count per guardian index:", Object.fromEntries([...counts.entries()].sort((a,b)=>a[0]-b[0])));
  console.log("signer-index combinations:", Object.fromEntries(combos));
}
main();
