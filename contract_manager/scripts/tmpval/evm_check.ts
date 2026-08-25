/** Full EVM validation for proposal 9yuPH43... : guardian sets, wormhole rewiring, code digests. */
import { readFileSync, writeFileSync } from "node:fs";
import Web3 from "web3";

const K = Web3.utils.keccak256;
const sel = (sig: string) => K(sig).slice(0, 10);
const SEL = {
  currentGsIdx: sel("getCurrentGuardianSetIndex()"),
  getGuardianSet: sel("getGuardianSet(uint32)"),
  whChainId: sel("chainId()"),
  pythWormhole: sel("wormhole()"),
  validDataSources: sel("validDataSources()"),
  version: sel("version()"),
  implSlotEip1967: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
};

type Ins = { i: number; kind: string; target: string; address?: string; dataSources?: any[] };
const proposals = JSON.parse(readFileSync("/tmp/proposals.json", "utf8"));
const p2 = proposals.find((p: any) => p.proposal.startsWith("9yu"));
const chainsJson = JSON.parse(readFileSync("src/store/chains/EvmChains.json", "utf8"));
const pfJson = JSON.parse(readFileSync("src/store/contracts/EvmPriceFeedContracts.json", "utf8"));
const rpcOf = new Map<string, string>(chainsJson.map((c: any) => [c.id, c.rpcUrl]));
const RPC_OVERRIDE: Record<string, string> = {
  base: "https://mainnet.base.org",
  sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
};
for (const [k, v] of Object.entries(RPC_OVERRIDE)) rpcOf.set(k, v);
const legacyPf = new Map<string, string>();
for (const c of pfJson) if (!("deploymentType" in c)) if (!legacyPf.has(c.chain)) legacyPf.set(c.chain, c.address);

// group instructions per chain
const byChain = new Map<string, { upgrade?: string; wormhole?: string; ds?: any[] }>();
for (const ins of p2.instructions as Ins[]) {
  const e = byChain.get(ins.target) ?? {};
  if (ins.kind === "EvmUpgradeContract") e.upgrade = "0x" + ins.address;
  if (ins.kind === "EvmSetWormholeAddress") e.wormhole = "0x" + ins.address;
  if (ins.kind === "SetDataSources") e.ds = ins.dataSources;
  byChain.set(ins.target, e);
}

async function rpc(url: string, method: string, params: any[]): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 25_000);
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: ac.signal,
      });
      clearTimeout(t);
      const j: any = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j.result;
    } catch (e: any) {
      if (attempt === 2) throw e;
      await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)));
    }
  }
}
const call = (url: string, to: string, data: string) => rpc(url, "eth_call", [{ to, data }, "latest"]);
const codeDigest = async (url: string, addr: string) => {
  const code = await rpc(url, "eth_getCode", [addr, "latest"]);
  if (!code || code === "0x") return { digest: null as string | null, stripped: null as string | null, size: 0 };
  // mirrors contract_manager getCodeDigestWithoutAddress: neutralise self-address immutables
  const stripped = code.replaceAll(addr.toLowerCase().replace("0x", ""), "0".repeat(40));
  return { digest: K(code), stripped: K(stripped), size: (code.length - 2) / 2 };
};

function decodeGuardianSet(hex: string) {
  // returns (Structs.GuardianSet { address[] keys; uint32 expirationTime })
  const b = hex.replace(/^0x/, "");
  const w = (i: number) => b.slice(i * 64, i * 64 + 64);
  const structOff = Number(BigInt("0x" + w(0))) / 32;
  const keysOff = structOff + Number(BigInt("0x" + w(structOff))) / 32;
  const expiration = Number(BigInt("0x" + w(structOff + 1)));
  const n = Number(BigInt("0x" + w(keysOff)));
  const keys: string[] = [];
  for (let i = 0; i < n; i++) keys.push("0x" + w(keysOff + 1 + i).slice(24));
  return { keys, expiration };
}

async function main() {
  const out: any[] = [];
  const entries = [...byChain.entries()];
  const CONC = 6;
  let idx = 0;
  async function worker() {
    while (idx < entries.length) {
      const my = idx++;
      const [chain, e] = entries[my];
      const url = rpcOf.get(chain);
      const row: any = { chain, rpc: url, proposedImpl: e.upgrade, proposedWormhole: e.wormhole, pythProxy: legacyPf.get(chain) };
      try {
        if (!url) throw new Error("no rpc in store");
        // --- guardian set on the PROPOSED wormhole ---
        const gsIdxRaw = await call(url, e.wormhole!, SEL.currentGsIdx);
        row.newWhGuardianSetIndex = Number(BigInt(gsIdxRaw));
        const gsRaw = await call(url, e.wormhole!, SEL.getGuardianSet + row.newWhGuardianSetIndex.toString(16).padStart(64, "0"));
        const gs = decodeGuardianSet(gsRaw);
        row.newWhGuardians = gs.keys;
        row.newWhGuardianExpiration = gs.expiration;
        row.newWhChainId = Number(BigInt(await call(url, e.wormhole!, SEL.whChainId)));
        // --- current wormhole wired into the legacy Pyth proxy ---
        const proxy = legacyPf.get(chain)!;
        const curWhRaw = await call(url, proxy, SEL.pythWormhole);
        row.currentWormhole = "0x" + curWhRaw.slice(-40);
        const cIdx = await call(url, row.currentWormhole, SEL.currentGsIdx);
        row.currentWhGuardianSetIndex = Number(BigInt(cIdx));
        const cgs = decodeGuardianSet(await call(url, row.currentWormhole, SEL.getGuardianSet + row.currentWhGuardianSetIndex.toString(16).padStart(64, "0")));
        row.currentWhGuardians = cgs.keys;
        // --- implementation code digests ---
        const implRaw = await rpc(url, "eth_getStorageAt", [proxy, SEL.implSlotEip1967, "latest"]);
        row.currentImpl = "0x" + implRaw.slice(-40);
        const cd = await codeDigest(url, row.currentImpl);
        row.currentImplDigest = cd.digest;
        row.currentImplDigestStripped = cd.stripped;
        const nd = await codeDigest(url, e.upgrade!);
        row.proposedImplDigest = nd.digest;
        row.proposedImplDigestStripped = nd.stripped;
        row.proposedImplCodeSize = nd.size;
        row.proposedImplHasCode = nd.size > 0;
        // --- data sources currently configured ---
        try {
          const ds = await call(url, proxy, SEL.validDataSources);
          row.currentDataSourcesRaw = ds;
        } catch { row.currentDataSourcesRaw = null; }
      } catch (err: any) {
        row.error = String(err.message ?? err).slice(0, 300);
      }
      out.push(row);
      console.log(`[${out.length}/${entries.length}] ${chain} ${row.error ? "ERROR: " + row.error : "ok"}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  out.sort((a, b) => a.chain.localeCompare(b.chain));
  writeFileSync("/tmp/evm_check.json", JSON.stringify(out, null, 2));
  console.log("wrote /tmp/evm_check.json");
}
main();
