import { readFileSync, writeFileSync } from "node:fs";
import Web3 from "web3";
const K = Web3.utils.keccak256;
const sel = (s: string) => K(s).slice(0, 10);
const SEL = {
  governanceDataSource: sel("governanceDataSource()"),
  validDataSources: sel("validDataSources()"),
  lastSeq: sel("lastExecutedGovernanceSequence()"),
  govDsIdx: sel("governanceDataSourceIndex()"),
  chainId: sel("chainId()"),
  version: sel("version()"),
  singleUpdateFeeInWei: sel("singleUpdateFeeInWei()"),
  whGovChainId: sel("governanceChainId()"),
  whGovContract: sel("governanceContract()"),
};
const R = JSON.parse(readFileSync("/tmp/evm_check.json", "utf8"));
async function rpc(url: string, method: string, params: any[]) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 25000);
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: ac.signal });
  clearTimeout(t); const j: any = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); return j.result;
}
const call = (u: string, to: string, d: string) => rpc(u, "eth_call", [{ to, data: d }, "latest"]);
function decDs(hex: string) { const b = hex.replace(/^0x/, ""); return { chainId: Number(BigInt("0x" + b.slice(0, 64))), emitter: "0x" + b.slice(64, 128) }; }
function decDsArr(hex: string) {
  const b = hex.replace(/^0x/, ""); const w = (i: number) => b.slice(i * 64, i * 64 + 64);
  const off = Number(BigInt("0x" + w(0))) / 32; const n = Number(BigInt("0x" + w(off)));
  const out = []; for (let i = 0; i < n; i++) out.push({ chainId: Number(BigInt("0x" + w(off + 1 + i * 2))), emitter: "0x" + w(off + 2 + i * 2) });
  return out;
}
async function main() {
  const out: any[] = [];
  for (const r of R) {
    const url = r.rpc, proxy = r.pythProxy;
    const row: any = { chain: r.chain };
    try {
      row.govDataSource = decDs(await call(url, proxy, SEL.governanceDataSource));
      row.validDataSources = decDsArr(await call(url, proxy, SEL.validDataSources));
      row.lastExecutedGovernanceSequence = BigInt(await call(url, proxy, SEL.lastSeq)).toString();
      row.governanceDataSourceIndex = Number(BigInt(await call(url, proxy, SEL.govDsIdx)));
      row.pythChainId = Number(BigInt(await call(url, proxy, SEL.chainId)));
      row.singleUpdateFeeInWei = BigInt(await call(url, proxy, SEL.singleUpdateFeeInWei)).toString();
      // new receiver's own governance authority
      row.newWhGovChainId = Number(BigInt(await call(url, r.proposedWormhole, SEL.whGovChainId)));
      row.newWhGovContract = await call(url, r.proposedWormhole, SEL.whGovContract);
      const curWh = r.currentWormhole;
      row.curWhGovChainId = Number(BigInt(await call(url, curWh, SEL.whGovChainId)));
      row.curWhGovContract = await call(url, curWh, SEL.whGovContract);
    } catch (e: any) { row.error = String(e.message).slice(0, 200); }
    out.push(row);
    console.log(`${row.chain} ${row.error ?? "ok"}`);
  }
  writeFileSync("/tmp/gov_check.json", JSON.stringify(out, null, 2));
}
main();
