import { readFileSync } from "node:fs";
import Web3 from "web3";
const K = Web3.utils.keccak256; const sel = (s: string) => K(s).slice(0, 10);
const S = { gds: sel("governanceDataSource()"), vds: sel("validDataSources()"), wh: sel("wormhole()"), seq: sel("lastExecutedGovernanceSequence()"), cid: sel("chainId()") };
const chains = JSON.parse(readFileSync("src/store/chains/EvmChains.json", "utf8"));
const pf = JSON.parse(readFileSync("src/store/contracts/EvmPriceFeedContracts.json", "utf8"));
const rpcOf = new Map<string, string>(chains.map((c: any) => [c.id, c.rpcUrl]));
rpcOf.set("base", "https://mainnet.base.org"); rpcOf.set("sepolia", "https://ethereum-sepolia-rpc.publicnode.com");
const pro = pf.filter((c: any) => c.deploymentType === "pro-compatible-production");
async function call(url: string, to: string, data: string) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }), signal: ac.signal });
  clearTimeout(t); const j: any = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); return j.result;
}
async function main() {
  for (const c of pro) {
    const url = rpcOf.get(c.chain);
    if (!url) { console.log(`${c.chain} NO RPC`); continue; }
    try {
      const gds = await call(url, c.address, S.gds);
      const b = gds.replace(/^0x/, "");
      const wh = "0x" + (await call(url, c.address, S.wh)).slice(-40);
      const seq = BigInt(await call(url, c.address, S.seq)).toString();
      console.log(`${c.chain.padEnd(24)} proxy=${c.address} wormhole=${wh} govDS=(chain ${Number(BigInt("0x" + b.slice(0, 64)))}, 0x${b.slice(64, 128)}) lastSeq=${seq}`);
    } catch (e: any) { console.log(`${c.chain.padEnd(24)} ERR ${String(e.message).slice(0, 120)}`); }
  }
}
main();
