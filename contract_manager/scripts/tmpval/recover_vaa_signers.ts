/** Recover the signer addresses of an accumulator-update VAA from the upgraded Hermes. */
import Web3 from "web3";


const web3 = new Web3();
const keccak256 = Web3.utils.keccak256;

function parsePnau(hex: string) {
  const buf = Buffer.from(hex.replace(/^0x/, ""), "hex");
  if (buf.subarray(0, 4).toString("hex") !== "504e4155") throw new Error("not PNAU");
  let o = 4;
  const major = buf[o++], minor = buf[o++];
  const trailingLen = buf[o++];
  o += trailingLen;
  const updateType = buf[o++];
  const vaaLen = buf.readUInt16BE(o); o += 2;
  const vaa = buf.subarray(o, o + vaaLen);
  return { major, minor, updateType, vaa };
}

function parseVaa(vaa: Buffer) {
  let o = 0;
  const version = vaa[o++];
  const guardianSetIndex = vaa.readUInt32BE(o); o += 4;
  const numSignatures = vaa[o++];
  const sigs: { index: number; sig: Buffer }[] = [];
  for (let i = 0; i < numSignatures; i++) {
    const index = vaa[o++];
    const sig = vaa.subarray(o, o + 65); o += 65;
    sigs.push({ index, sig });
  }
  const body = vaa.subarray(o);
  const timestamp = body.readUInt32BE(0);
  const nonce = body.readUInt32BE(4);
  const emitterChain = body.readUInt16BE(8);
  const emitterAddress = body.subarray(10, 42).toString("hex");
  const sequence = body.readBigUInt64BE(42);
  const consistency = body[50];
  const payload = body.subarray(51);
  const hash = keccak256("0x" + keccak256("0x" + body.toString("hex")).slice(2));
  return { version, guardianSetIndex, sigs, timestamp, nonce, emitterChain, emitterAddress, sequence, consistency, payload, hash };
}

async function main() {
  const url = "https://pyth.dourolabs.app/hermes/v2/updates/price/latest?ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43&encoding=hex";
  const seen = new Map<number, string>();
  let gsIndex = -1, emitter = "", emitterChain = -1;
  for (let round = 0; round < Number(process.env.ROUNDS ?? 25); round++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.PYTH_API_KEY}` } });
    const json: any = await res.json();
    const { vaa } = parsePnau(json.binary.data[0]);
    const p = parseVaa(vaa);
    gsIndex = p.guardianSetIndex; emitter = p.emitterAddress; emitterChain = p.emitterChain;
    for (const s of p.sigs) {
      const r = "0x" + s.sig.subarray(0, 32).toString("hex");
      const sv = "0x" + s.sig.subarray(32, 64).toString("hex");
      const v = s.sig[64] + 27;
      const addr = web3.eth.accounts.recover(p.hash, "0x" + v.toString(16), r, sv, true);
      const prev = seen.get(s.index);
      if (prev && prev.toLowerCase() !== addr.toLowerCase()) throw new Error(`index ${s.index} conflict ${prev} vs ${addr}`);
      seen.set(s.index, addr);
    }
    if (seen.size >= 5) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log("guardianSetIndex:", gsIndex);
  console.log("emitterChain:", emitterChain, "emitter:", emitter, `("${Buffer.from(emitter, "hex").toString("utf8")}")`);
  console.log("recovered signers (index -> address):");
  for (const i of [...seen.keys()].sort((a, b) => a - b)) console.log(`  ${i}: ${seen.get(i)!.toLowerCase()}`);
  console.log("count:", seen.size);
}
main();
