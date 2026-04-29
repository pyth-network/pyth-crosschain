/* eslint-disable no-console */
/**
 * Runs sync_wormhole_guardian_set in a loop until all contracts are updated.
 * On RPC errors (timeouts, etc.), updates EvmChains.json with public RPCs from
 * https://chainlist.org/rpcs.json
 *
 * Usage: pnpm tsx scripts/sync_wormhole_guardian_set_loop.ts --private-key <key> --target-index 5
 */
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

function buildSyncArgs(rawArgs: string[]): string[] {
  const out = [...rawArgs];
  if (!out.includes("--json")) {
    out.push("--json");
  }
  return out;
}

const EVM_RPC_LIST_URL = "https://chainlist.org/rpcs.json";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_MANAGER_ROOT = path.resolve(SCRIPT_DIR, "..");
const EVM_CHAINS_PATH = path.join(
  CONTRACT_MANAGER_ROOT,
  "src/store/chains/EvmChains.json",
);

interface SyncRow {
  chainName: string;
  startIndex: string;
  endIndex: string;
  error?: string;
}

interface SyncOutput {
  rows: SyncRow[];
  needRetry: boolean;
}

interface EvmChainEntry {
  id: string;
  mainnet?: boolean;
  networkId: number;
  rpcUrl: string;
  type: string;
  nativeToken?: string;
}

interface ChainlistRpcEntry {
  url: string;
  tracking?: string;
  isOpenSource?: boolean;
}

interface ChainlistChainEntry {
  name?: string;
  chain?: string;
  shortName?: string;
  chainId: number;
  rpc: (ChainlistRpcEntry | string)[];
}

type ChainlistRpcList = ChainlistChainEntry[];

async function fetchEvmRpcList(): Promise<ChainlistRpcList> {
  const res = await fetch(EVM_RPC_LIST_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch EVM RPC list: ${res.status}`);
  }
  const data = (await res.json()) as ChainlistRpcList;
  return data;
}

function extractEndpoints(entry: ChainlistChainEntry): string[] {
  return entry.rpc
    .map((r) => (typeof r === "string" ? r : r.url))
    .filter((url): url is string => typeof url === "string" && url.length > 0)
    .filter((url) => url.startsWith("https://") && !url.includes("${"));
}

/**
 * Many EVM chains share the same chain ID (e.g. Ronin testnet and Edgeware
 * both report 2021), so matching purely by `chainId` from chainlist.org is
 * unsafe — we'd happily swap a chain's RPC for an unrelated network's. To
 * verify identity we also require an expected keyword (derived from our own
 * chain id, with manual aliases for known mismatches) to appear in the
 * chainlist entry's name/chain/shortName fields.
 */
const CHAIN_ID_KEYWORD_ALIASES: Record<string, string[]> = {
  bsc: ["bsc", "bnb", "binance"],
  bsc_testnet: ["bsc", "bnb", "binance"],
  mumbai: ["mumbai", "polygon"],
  matic: ["matic", "polygon"],
  zksync: ["zksync"],
  optimism: ["optimism", "op"],
  arbitrum: ["arbitrum", "arb"],
  ethereum: ["ethereum", "eth"],
  saigon: ["saigon", "ronin"],
};

function expectedKeywords(chainId: string): string[] {
  if (CHAIN_ID_KEYWORD_ALIASES[chainId]) {
    return CHAIN_ID_KEYWORD_ALIASES[chainId];
  }
  // Strip common environment suffixes, then take the first word.
  const stripped = chainId.replace(
    /_(?:mainnet|testnet|devnet|sepolia|goerli|holesky)$/i,
    "",
  );
  const firstWord = stripped.split(/[_-]/)[0];
  return firstWord ? [firstWord.toLowerCase()] : [];
}

function chainEntryMatches(
  entry: ChainlistChainEntry,
  keywords: string[],
): boolean {
  const haystack = [entry.name, entry.chain, entry.shortName]
    .filter((s): s is string => typeof s === "string")
    .join(" ")
    .toLowerCase();
  return keywords.some((k) => haystack.includes(k));
}

function getAlternativeRpc(
  rpcList: ChainlistRpcList,
  chain: EvmChainEntry,
  currentRpcUrl: string,
): string | undefined {
  const matches = rpcList.filter((c) => c.chainId === chain.networkId);
  if (matches.length === 0) return undefined;
  const keywords = expectedKeywords(chain.id);
  const verified = matches.find((c) => chainEntryMatches(c, keywords));
  if (!verified) {
    const names = matches.map((m) => m.name ?? m.chain ?? "?").join(", ");
    console.warn(
      `  [${chain.id}] chainId ${chain.networkId} matched ${matches.length} chainlist entries (${names}); none identified as "${keywords.join("/")}". Skipping RPC update to avoid chain collision.`,
    );
    return undefined;
  }
  const endpoints = extractEndpoints(verified);
  if (endpoints.length === 0) return undefined;
  const currentIdx = endpoints.indexOf(currentRpcUrl);
  const tryNext = currentIdx >= 0 ? currentIdx + 1 : 0;
  return endpoints[tryNext % endpoints.length];
}

function updateEvmChainRpc(
  chainId: string,
  newRpcUrl: string,
): boolean {
  const raw = fs.readFileSync(EVM_CHAINS_PATH, "utf-8");
  const chains = JSON.parse(raw) as EvmChainEntry[];
  const entry = chains.find((c) => c.id === chainId);
  if (!entry) return false;
  entry.rpcUrl = newRpcUrl;
  fs.writeFileSync(EVM_CHAINS_PATH, JSON.stringify(chains, null, 2) + "\n");
  return true;
}

function getEvmChainById(chainId: string): EvmChainEntry | undefined {
  const raw = fs.readFileSync(EVM_CHAINS_PATH, "utf-8");
  const chains = JSON.parse(raw) as EvmChainEntry[];
  return chains.find((c) => c.id === chainId);
}

function runSync(args: string[]): { exitCode: number; output: SyncOutput } {
  const cmd = `pnpm tsx scripts/sync_wormhole_guardian_set.ts ${args.join(" ")}`;
  const fullOutput: string[] = [];
  let exitCode = 0;
  try {
    const out = execSync(cmd, {
      cwd: CONTRACT_MANAGER_ROOT,
      encoding: "utf-8",
      stdio: ["inherit", "pipe", "inherit"],
    });
    fullOutput.push(out);
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string };
    exitCode = typeof e.status === "number" ? e.status : 1;
    if (e.stdout) fullOutput.push(e.stdout);
  }
  const lastLine = fullOutput.join("").trim().split("\n").filter(Boolean).pop();
  let output: SyncOutput = { rows: [], needRetry: true };
  if (lastLine) {
    try {
      output = JSON.parse(lastLine) as SyncOutput;
    } catch {
      // Not JSON: script may have failed before printing (e.g. invalid key)
      if (exitCode !== 0) {
        console.error("Sync script failed before producing JSON. Last output:");
        console.error(fullOutput.join("").trim().slice(-500));
        process.exit(exitCode);
      }
      output = { rows: [], needRetry: false };
    }
  }
  return { exitCode, output };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const syncArgs = buildSyncArgs(rawArgs);

  let rpcList: ChainlistRpcList | null = null;
  let iteration = 0;

  for (;;) {
    iteration += 1;
    console.log(`\n--- Sync iteration ${iteration} ---\n`);
    const { exitCode, output } = runSync(syncArgs);

    if (exitCode === 0 && !output.needRetry) {
      console.log("All contracts are up to date.");
      process.exit(0);
    }

    const errorRows = output.rows.filter((r) => r.error);
    if (errorRows.length === 0) {
      console.log(
        "Some chains were updated this round; re-running to confirm all are done.",
      );
      continue;
    }

    console.log(
      `Chains with errors (${errorRows.length}): ${errorRows.map((r) => r.chainName).join(", ")}`,
    );

    let updated = 0;
    for (const row of errorRows) {
      const evmChain = getEvmChainById(row.chainName);
      if (!evmChain) {
        console.log(
          `  [${row.chainName}] Not an EVM chain (or not in EvmChains.json); skipping RPC update.`,
        );
        continue;
      }
      if (!rpcList) {
        console.log("Fetching public EVM RPC list from chainlist.org...");
        rpcList = await fetchEvmRpcList();
      }
      const newRpc = getAlternativeRpc(rpcList, evmChain, evmChain.rpcUrl);
      if (!newRpc) {
        // getAlternativeRpc already logged the reason (no entry / collision).
        continue;
      }
      updateEvmChainRpc(row.chainName, newRpc);
      console.log(`  [${row.chainName}] Updated RPC to: ${newRpc}`);
      updated += 1;
    }

    if (updated === 0) {
      console.log(
        "\nNo EVM RPCs could be updated. Remaining errors may be non-EVM or have no chainlist fallback. Exiting.",
      );
      process.exit(1);
    }
  }
}

main();
