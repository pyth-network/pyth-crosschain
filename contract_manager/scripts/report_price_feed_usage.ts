/** biome-ignore-all lint/style/noProcessEnv: this is a CLI script */
/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */

/**
 * Reports which Pyth price feeds are actually written on-chain on the EVM mainnets that
 * survive the Pyth Core upgrade, so that every feed in real use can be checked against the
 * Pyth Pro catalog before Core is switched off.
 *
 * Usage: `pnpm tsx scripts/report_price_feed_usage.ts --days 30 --output usage.csv`
 *
 * How usage is measured, and what the numbers do and do not mean:
 *
 * - A count is the number of `PriceFeedUpdate` logs emitted by a Pyth contract. That event
 *   fires only when an update is *fresh* — carrying a newer `publishTime` than the stored
 *   one — so the counts measure accepted writes, not `updatePriceFeeds` calls.
 * - A consumer that only *reads* a feed (`getPriceNoOlderThan`) emits nothing and relies on
 *   somebody else pushing. Treat "at least one update in the window" as the in-use signal
 *   and the count itself as a magnitude hint, not a usage share.
 * - Both the legacy Core contract and the upgraded (`pro-compatible-production`) contract are
 *   live during the migration, so both are scanned on every chain and summed into the chain's
 *   column. The `*_split.csv` companion breaks the same numbers down by contract, which is
 *   how far each chain has migrated.
 *
 * `supported_on_pro` is membership of the feed id in the Pro Hermes catalog
 * (`/hermes/v2/price_feeds`). That endpoint returns an identical response with a valid API
 * key, an invalid one, and no `Authorization` header at all, so it is *not* scoped to the
 * caller's entitlements — it lists exactly the Pro symbols in state `stable`. The `pro_state`
 * column comes from the full Lazer symbol registry (`/v1/symbols`) and distinguishes the
 * feeds Pro has not promoted yet (`coming_soon`, `inactive`) from the ones it does not know
 * about at all (`absent`).
 *
 * Coverage is reported honestly. Public RPCs cap `eth_getLogs` ranges (50 blocks on some
 * chains), rate-limit aggressively, and some refuse 30-day-old logs entirely, so a chain that
 * could not be scanned over the whole window is marked `_INCOMPLETE` in the main CSV and gets
 * the block range it actually covered in the coverage CSV. Point such a chain at a paid
 * archive endpoint with `--rpc <chain>=<url>` (or through the `$ENV_*` placeholders the chain
 * store already supports) and re-run; the run resumes from its checkpoint file.
 */

import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { EvmChain } from "../src/core/chains";
import { EvmPriceFeedContract } from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";
import { sleep } from "../src/utils/sleep";

const HERMES_CORE_FEEDS_URL = "https://hermes.pyth.network/v2/price_feeds";
const PRO_HERMES_FEEDS_URL = "https://pyth.dourolabs.app/hermes/v2/price_feeds";
const PRO_SYMBOLS_URL = "https://pyth.dourolabs.app/v1/symbols";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --days 30 --output usage.csv")
  .options({
    chains: {
      desc: "Restrict the scan to these chain ids (defaults to every in-scope chain)",
      string: true,
      type: "array",
    },
    days: {
      default: 30,
      desc: "Size of the lookback window in days",
      type: "number",
    },
    fresh: {
      default: false,
      desc: "Ignore any existing checkpoint file and scan the window from scratch",
      type: "boolean",
    },
    "max-chunk-size": {
      default: 100_000,
      desc: "Upper bound on the block span of a single eth_getLogs request",
      type: "number",
    },
    output: {
      default: "price_feed_usage.csv",
      desc: "Path of the main CSV; the split and coverage CSVs are written alongside it",
      type: "string",
    },
    "request-concurrency": {
      default: 8,
      desc: "eth_getLogs requests in flight per contract scan",
      type: "number",
    },
    rpc: {
      desc: "Override a chain's RPC endpoint, as <chain>=<url>. Repeatable",
      string: true,
      type: "array",
    },
    "scan-concurrency": {
      default: 4,
      desc: "Contract scans running in parallel",
      type: "number",
    },
    "state-file": {
      default: "price_feed_usage_state.json",
      desc: "Checkpoint file; a run resumes from it unless --fresh is passed",
      type: "string",
    },
  })
  .epilogue(
    "A full 30-day run takes hours and is resumable: interrupt it and re-run the same " +
      "command to continue from the checkpoint file. Chains whose RPC cannot serve the " +
      "whole window are reported as incomplete rather than silently under-counted.",
  );

type Deployment = "legacy" | "upgraded";

type ScanTarget = {
  key: string;
  chainId: string;
  deployment: Deployment;
  contract: EvmPriceFeedContract;
};

type ScanState = {
  chain: string;
  address: string;
  deployment: Deployment;
  fromBlock: number;
  toBlock: number;
  /** First block not yet counted; equals `toBlock + 1` once the scan is complete. */
  nextBlock: number;
  counts: Record<string, number>;
  status: "pending" | "complete" | "failed";
  error?: string;
  scannedFromUnix?: number;
  scannedThroughUnix?: number;
};

type ReportState = {
  days: number;
  windowStartUnix: number;
  windowEndUnix: number;
  scans: Record<string, ScanState>;
};

/**
 * The chains that survive the upgrade: EVM mainnets carrying a price feed contract marked
 * `pro-compatible-production`. Both that contract and the chain's legacy Core contract are
 * scanned, since integrators migrate at their own pace and traffic is split across the two.
 */
function getScanTargets(
  chainFilter: string[] | undefined,
  rpcOverrides: Map<string, string>,
): ScanTarget[] {
  const evmPriceFeedContracts = Object.values(DefaultStore.contracts).filter(
    (contract): contract is EvmPriceFeedContract =>
      contract instanceof EvmPriceFeedContract,
  );
  const inScopeChains = new Set(
    evmPriceFeedContracts
      .filter(
        (contract) =>
          contract.deploymentType === "pro-compatible-production" &&
          contract.getChain().isMainnet(),
      )
      .map((contract) => contract.getChain().getId()),
  );

  if (chainFilter !== undefined) {
    for (const chainId of chainFilter) {
      if (!inScopeChains.has(chainId)) {
        throw new Error(
          `${chainId} is not an in-scope chain. In scope: ${[...inScopeChains].sort().join(", ")}`,
        );
      }
    }
  }

  return evmPriceFeedContracts
    .filter(
      (contract) =>
        inScopeChains.has(contract.getChain().getId()) &&
        (chainFilter === undefined ||
          chainFilter.includes(contract.getChain().getId())),
    )
    .map((contract) => {
      const chainId = contract.getChain().getId();
      const overriddenRpc = rpcOverrides.get(chainId);
      return {
        chainId,
        contract:
          overriddenRpc === undefined
            ? contract
            : withRpcUrl(contract, overriddenRpc),
        deployment:
          contract.deploymentType === "pro-compatible-production"
            ? ("upgraded" as const)
            : ("legacy" as const),
        key: `${chainId}:${contract.address}`,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function withRpcUrl(
  contract: EvmPriceFeedContract,
  rpcUrl: string,
): EvmPriceFeedContract {
  const chain = contract.getChain();
  return new EvmPriceFeedContract(
    new EvmChain(
      chain.getId(),
      chain.isMainnet(),
      chain.getNativeToken(),
      rpcUrl,
      chain.networkId,
    ),
    contract.address,
    contract.deploymentType,
  );
}

function parseRpcOverrides(overrides: string[]): Map<string, string> {
  return new Map(
    overrides.map((override) => {
      const separator = override.indexOf("=");
      if (separator === -1) {
        throw new Error(`--rpc expects <chain>=<url>, got "${override}"`);
      }
      return [
        override.slice(0, separator),
        override.slice(separator + 1),
      ] as const;
    }),
  );
}

type FeedMetadata = {
  name: string;
  symbol: string;
  assetType: string;
};

/** State of a feed in the Pro catalog; `absent` means Pro has no symbol for it at all. */
type ProState = "stable" | "coming_soon" | "inactive" | "absent";

type FeedCatalog = {
  metadata: Map<string, FeedMetadata>;
  supportedOnPro: Set<string>;
  proStates: Map<string, ProState>;
};

async function fetchJson<T>(url: string, apiKey: string | undefined) {
  const response = await fetch(url, {
    headers: apiKey === undefined ? {} : { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(
      `GET ${url} failed: ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as T;
}

async function fetchFeedCatalog(apiKey: string | undefined) {
  type HermesFeed = {
    id: string;
    attributes: {
      symbol?: string;
      display_symbol?: string;
      asset_type?: string;
    };
  };
  type ProSymbol = { hermes_id: string | null; state: string };

  const [coreFeeds, proFeeds, proSymbols] = await Promise.all([
    fetchJson<HermesFeed[]>(HERMES_CORE_FEEDS_URL, undefined),
    fetchJson<HermesFeed[]>(PRO_HERMES_FEEDS_URL, apiKey),
    fetchJson<ProSymbol[]>(PRO_SYMBOLS_URL, apiKey),
  ]);

  const metadata = new Map<string, FeedMetadata>();
  for (const feed of [...coreFeeds, ...proFeeds]) {
    metadata.set(feed.id.toLowerCase(), {
      assetType: feed.attributes.asset_type ?? "UNKNOWN",
      name: feed.attributes.display_symbol ?? "UNKNOWN",
      symbol: feed.attributes.symbol ?? "UNKNOWN",
    });
  }

  const proStates = new Map<string, ProState>();
  for (const symbol of proSymbols) {
    if (symbol.hermes_id === null) continue;
    if (
      symbol.state === "stable" ||
      symbol.state === "coming_soon" ||
      symbol.state === "inactive"
    ) {
      proStates.set(symbol.hermes_id.toLowerCase(), symbol.state);
    }
  }

  return {
    metadata,
    proStates,
    supportedOnPro: new Set(proFeeds.map((feed) => feed.id.toLowerCase())),
  } satisfies FeedCatalog;
}

async function loadState(
  stateFile: string,
  days: number,
): Promise<ReportState | undefined> {
  let contents: string;
  try {
    contents = await readFile(stateFile, "utf8");
  } catch {
    return undefined;
  }
  const state = JSON.parse(contents) as ReportState;
  if (state.days !== days) {
    throw new Error(
      `${stateFile} checkpoints a ${state.days}-day window but --days is ${days}. ` +
        "Pass --fresh to restart, or --state-file to keep both runs.",
    );
  }
  return state;
}

function saveState(stateFile: string, state: ReportState) {
  writeFileSync(stateFile, JSON.stringify(state));
}

/** A scan only has a meaningful window once its block range resolved; `toBlock` is 0 until then. */
function hasResolvedRange(scan: ScanState) {
  return scan.toBlock > 0;
}

/**
 * Retries because a single flaky `eth_getBlockByNumber` would otherwise drop a whole chain
 * from the report for the entire run, which reads as "no feeds used here".
 */
async function resolveBlockRange(chain: EvmChain, state: ReportState) {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      const [fromBlock, toBlock] = await Promise.all([
        chain.getBlockNumberAtTimestamp(state.windowStartUnix),
        chain.getBlockNumberAtTimestamp(state.windowEndUnix),
      ]);
      return { fromBlock, toBlock };
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) throw error;
      console.warn(
        `  [${chain.getId()}] resolving block range attempt ${attempt} failed: ${error}`,
      );
      await sleep(1000 * attempt);
    }
  }
}

async function getBlockTimestamp(chain: EvmChain, blockNumber: number) {
  const block = await chain.getWeb3().eth.getBlock(blockNumber);
  return Number(block.timestamp);
}

async function scanTarget(
  target: ScanTarget,
  scan: ScanState,
  options: {
    requestConcurrency: number;
    maxChunkSize: number;
    onProgress: () => void;
  },
) {
  for await (const batch of target.contract.streamPriceFeedUpdateCounts({
    concurrency: options.requestConcurrency,
    fromBlock: scan.nextBlock,
    maxChunkSize: options.maxChunkSize,
    onRetry: (message) => {
      console.warn(`  [${target.key}] ${message}`);
    },
    toBlock: scan.toBlock,
  })) {
    for (const [feedId, count] of batch.counts) {
      scan.counts[feedId] = (scan.counts[feedId] ?? 0) + count;
    }
    scan.nextBlock = batch.toBlock + 1;
    options.onProgress();
  }
  scan.status = "complete";
  delete scan.error;
}

/**
 * Records the wall-clock window the scan actually covered. Without it an incomplete scan is
 * indistinguishable from a feed that genuinely stopped being updated, which is the exact
 * wrong conclusion for this report to support.
 */
async function recordScannedWindow(chain: EvmChain, scan: ScanState) {
  const scannedThrough = scan.nextBlock - 1;
  if (scannedThrough < scan.fromBlock) return;
  try {
    const [from, through] = await Promise.all([
      getBlockTimestamp(chain, scan.fromBlock),
      getBlockTimestamp(chain, scannedThrough),
    ]);
    scan.scannedFromUnix = from;
    scan.scannedThroughUnix = through;
  } catch {
    // The endpoint that failed the scan will usually fail this too; the block range in the
    // coverage CSV still tells the reader what was and was not covered.
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  const queue = [...items];
  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, queue.length)) },
    async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        await worker(item);
      }
    },
  );
  await Promise.all(runners);
}

function toCsvField(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath: string, rows: (string | number)[][]) {
  writeFileSync(
    filePath,
    rows.map((row) => row.map(toCsvField).join(",")).join("\n") + "\n",
  );
}

function toUtc(unixSeconds: number | undefined) {
  return unixSeconds === undefined
    ? ""
    : new Date(unixSeconds * 1000).toISOString();
}

type ChainTotals = {
  total: number;
  legacy: number;
  upgraded: number;
};

function aggregateByFeed(scans: ScanState[]) {
  const byFeed = new Map<string, Map<string, ChainTotals>>();
  for (const scan of scans) {
    for (const [feedId, count] of Object.entries(scan.counts)) {
      const byChain = byFeed.get(feedId) ?? new Map<string, ChainTotals>();
      byFeed.set(feedId, byChain);
      const totals = byChain.get(scan.chain) ?? {
        legacy: 0,
        total: 0,
        upgraded: 0,
      };
      totals.total += count;
      totals[scan.deployment] += count;
      byChain.set(scan.chain, totals);
    }
  }
  return byFeed;
}

function writeReport(
  outputPath: string,
  state: ReportState,
  catalog: FeedCatalog,
) {
  const scans = Object.values(state.scans);
  const chainIds = [...new Set(scans.map((scan) => scan.chain))].sort();
  const incompleteChains = new Set(
    scans
      .filter((scan) => scan.status !== "complete")
      .map((scan) => scan.chain),
  );
  const byFeed = aggregateByFeed(scans);

  const feedRows = [...byFeed.entries()]
    .map(([feedId, byChain]) => {
      const metadata = catalog.metadata.get(feedId);
      return {
        assetType: metadata?.assetType ?? "UNKNOWN",
        byChain,
        feedId,
        name: metadata?.name ?? "UNKNOWN",
        proState: catalog.proStates.get(feedId) ?? "absent",
        supportedOnPro: catalog.supportedOnPro.has(feedId),
        symbol: metadata?.symbol ?? "UNKNOWN",
        total: [...byChain.values()].reduce(
          (sum, totals) => sum + totals.total,
          0,
        ),
      };
    })
    .sort((a, b) => b.total - a.total || a.feedId.localeCompare(b.feedId));

  writeCsv(outputPath, [
    [
      "feed_name",
      "feed_symbol",
      "asset_type",
      "feed_id",
      "supported_on_pro",
      "pro_state",
      "total_updates",
      ...chainIds.map((chainId) =>
        incompleteChains.has(chainId) ? `${chainId}_INCOMPLETE` : chainId,
      ),
    ],
    ...feedRows.map((row) => [
      row.name,
      row.symbol,
      row.assetType,
      row.feedId,
      String(row.supportedOnPro),
      row.proState,
      row.total,
      ...chainIds.map((chainId) => row.byChain.get(chainId)?.total ?? 0),
    ]),
  ]);

  const splitPath = companionPath(outputPath, "split");
  writeCsv(splitPath, [
    [
      "feed_name",
      "feed_id",
      "total_updates",
      ...chainIds.flatMap((chainId) => [
        `${chainId}_legacy`,
        `${chainId}_upgraded`,
      ]),
    ],
    ...feedRows.map((row) => [
      row.name,
      row.feedId,
      row.total,
      ...chainIds.flatMap((chainId) => [
        row.byChain.get(chainId)?.legacy ?? 0,
        row.byChain.get(chainId)?.upgraded ?? 0,
      ]),
    ]),
  ]);

  const coveragePath = companionPath(outputPath, "coverage");
  writeCsv(coveragePath, [
    [
      "chain",
      "contract_address",
      "deployment",
      "status",
      "from_block",
      "to_block",
      "scanned_through_block",
      "blocks_scanned",
      "blocks_missing",
      "requested_window_start_utc",
      "requested_window_end_utc",
      "scanned_window_start_utc",
      "scanned_window_end_utc",
      "total_updates",
      "error",
    ],
    ...scans
      .toSorted((a, b) => a.chain.localeCompare(b.chain))
      .map((scan) => {
        // A scan whose block range never resolved (dead RPC) has no window to report on, so
        // its block columns stay blank rather than claiming a scanned range of zero blocks.
        const resolved = hasResolvedRange(scan);
        const scannedBlocks = Math.max(0, scan.nextBlock - scan.fromBlock);
        return [
          scan.chain,
          scan.address,
          scan.deployment,
          scan.status,
          resolved ? scan.fromBlock : "",
          resolved ? scan.toBlock : "",
          resolved && scannedBlocks > 0 ? scan.nextBlock - 1 : "",
          scannedBlocks,
          resolved ? Math.max(0, scan.toBlock - scan.nextBlock + 1) : "",
          toUtc(state.windowStartUnix),
          toUtc(state.windowEndUnix),
          toUtc(scan.scannedFromUnix),
          toUtc(scan.scannedThroughUnix),
          Object.values(scan.counts).reduce((sum, count) => sum + count, 0),
          scan.error ?? "",
        ];
      }),
  ]);

  return {
    coveragePath,
    feedCount: feedRows.length,
    incompleteChains,
    splitPath,
  };
}

function companionPath(outputPath: string, suffix: string) {
  const extension = path.extname(outputPath);
  const base = outputPath.slice(0, outputPath.length - extension.length);
  return `${base}_${suffix}${extension}`;
}

async function main() {
  const argv = await parser.argv;

  const rpcOverrides = parseRpcOverrides(argv.rpc ?? []);
  const targets = getScanTargets(argv.chains, rpcOverrides);
  if (targets.length === 0) {
    throw new Error("No in-scope contracts matched the requested chains");
  }

  const existingState = argv.fresh
    ? undefined
    : await loadState(argv["state-file"], argv.days);
  const nowUnix = Math.floor(Date.now() / 1000);
  const state: ReportState = existingState ?? {
    days: argv.days,
    scans: {},
    windowEndUnix: nowUnix,
    windowStartUnix: nowUnix - argv.days * 24 * 60 * 60,
  };
  console.log(
    `Scanning ${targets.length} contracts over ${toUtc(state.windowStartUnix)} .. ${toUtc(state.windowEndUnix)}`,
  );

  const catalogPromise = fetchFeedCatalog(process.env.PYTH_API_KEY);
  // Awaited only after the scan, which is hours later. Without a handler attached now, a
  // Hermes failure would be an unhandled rejection and take the whole run down with it.
  catalogPromise.catch(() => undefined);

  // Block ranges are resolved per chain rather than per contract: the binary search costs
  // ~25 RPC round trips and both of a chain's contracts share the same window.
  const blockRanges = new Map<
    string,
    Promise<{ fromBlock: number; toBlock: number }>
  >();

  let lastSaveMs = 0;
  const saveThrottled = () => {
    const SAVE_INTERVAL_MS = 5000;
    if (Date.now() - lastSaveMs < SAVE_INTERVAL_MS) return;
    lastSaveMs = Date.now();
    saveState(argv["state-file"], state);
  };

  await runWithConcurrency(
    targets,
    argv["scan-concurrency"],
    async (target) => {
      const chain = target.contract.getChain();
      let scan = state.scans[target.key];
      try {
        // A checkpointed scan whose range never resolved covers nothing, so it is retried
        // from scratch instead of being resumed over an empty range and called complete.
        if (scan === undefined || !hasResolvedRange(scan)) {
          const range =
            blockRanges.get(target.chainId) ?? resolveBlockRange(chain, state);
          blockRanges.set(target.chainId, range);
          const { fromBlock, toBlock } = await range;
          scan = {
            address: target.contract.address,
            chain: target.chainId,
            counts: {},
            deployment: target.deployment,
            fromBlock,
            nextBlock: fromBlock,
            status: "pending",
            toBlock,
          };
          state.scans[target.key] = scan;
        }
        if (scan.status === "complete") {
          console.log(`${target.key}: already complete, skipping`);
          return;
        }
        console.log(
          `${target.key}: scanning blocks ${scan.nextBlock}..${scan.toBlock}`,
        );
        await scanTarget(target, scan, {
          maxChunkSize: argv["max-chunk-size"],
          onProgress: saveThrottled,
          requestConcurrency: argv["request-concurrency"],
        });
        console.log(`${target.key}: complete`);
      } catch (error) {
        if (scan === undefined) {
          // The block range could not be resolved, so nothing about this contract's window is
          // known. Record it as failed with an empty range so it still shows up in coverage.
          scan = {
            address: target.contract.address,
            chain: target.chainId,
            counts: {},
            deployment: target.deployment,
            fromBlock: 0,
            nextBlock: 0,
            status: "failed",
            toBlock: 0,
          };
          state.scans[target.key] = scan;
        }
        scan.status = "failed";
        scan.error = String(error);
        console.error(`${target.key}: FAILED - ${error}`);
      }
      await recordScannedWindow(chain, scan);
      saveState(argv["state-file"], state);
    },
  );

  saveState(argv["state-file"], state);

  const report = writeReport(argv.output, state, await catalogPromise);
  console.log(
    `\nWrote ${report.feedCount} feeds to ${argv.output}, ${report.splitPath}, ${report.coveragePath}`,
  );
  if (report.incompleteChains.size > 0) {
    console.warn(
      `\nWARNING: incomplete coverage on ${[...report.incompleteChains].sort().join(", ")}. ` +
        `Their counts are lower bounds — see ${report.coveragePath}, then re-run with ` +
        "--rpc <chain>=<archive-url> to fill the gaps.",
    );
  }
}

await main();
