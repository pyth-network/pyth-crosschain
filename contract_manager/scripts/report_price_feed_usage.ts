/** biome-ignore-all lint/style/noProcessEnv: this is a CLI script */
/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */

/**
 * Reports which Pyth price feeds are actually written on-chain on the mainnets that survive
 * the Pyth Core upgrade, so that every feed in real use can be checked against the Pyth Pro
 * catalog before Core is switched off.
 *
 * Usage: `pnpm tsx scripts/report_price_feed_usage.ts --days 30 --output usage.csv`
 *
 * Three platforms are covered, and they are counted by different mechanisms because none of
 * them share one. Every platform resolves a position range from the requested time window and
 * then streams counted sub-ranges of it, which is what makes coverage and resume uniform:
 *
 * | platform | position  | mechanism                                                  |
 * |----------|-----------|------------------------------------------------------------|
 * | EVM      | block     | `eth_getLogs` on the `PriceFeedUpdate` topic                 |
 * | Sui      | checkpoint| GraphQL `events` on `<pkg>::event::PriceFeedUpdateEvent`     |
 * | SVM      | slot      | receiver `post_update` instructions decoded from transactions|
 *
 * How usage is measured, and what the numbers do and do not mean:
 *
 * - On EVM a count is the number of `PriceFeedUpdate` logs emitted by a Pyth contract. That
 *   event fires only when an update is *fresh* — carrying a newer `publishTime` than the
 *   stored one — so the counts measure accepted writes, not `updatePriceFeeds` calls. Sui's
 *   `PriceFeedUpdateEvent` has the same contract: `update_cache` emits it only on a fresh
 *   update, so Sui counts are directly comparable to EVM ones.
 * - SVM counts are **not** strictly comparable. The receiver program emits no events, so a
 *   count there is the number of `post_update` / `post_update_atomic` instructions addressed
 *   to a feed. Sponsored pushes that the push-oracle rejects as stale never reach the
 *   receiver and so are not counted, but a consumer pull update that re-posts an already
 *   known price is. Read SVM numbers as "write attempts that reached the receiver".
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
 * the position range it actually covered in the coverage CSV. Point such a chain at a paid
 * archive endpoint with `--rpc <chain>=<url>` (or through the `$ENV_*` placeholders the chain
 * store already supports) and re-run; the run resumes from its checkpoint file.
 *
 * SVM is the chain where that matters most. Reconstructing counts costs one `getTransaction`
 * per receiver transaction, and `api.mainnet-beta.solana.com` serves ~1.25 of those per second
 * before returning HTTP 429, against a receiver that sees ~2.1 transactions per second. On the
 * public endpoint the scan therefore falls behind real time and lands as `_INCOMPLETE`; a
 * keyed endpoint (`SOLANA_MAINNET_API_KEY`, which the chain store's `rpcUrl` already expects)
 * is what makes a full window reachable.
 */

import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { EvmChain, SvmChain } from "../src/core/chains";
import {
  EvmPriceFeedContract,
  getSuiCheckpointAtTimestamp,
  getSuiCheckpointTimestamp,
  getSvmSlotAtTimestamp,
  SuiPriceFeedContract,
  SVM_PRICE_FEED_PROGRAMS,
  SvmPriceFeedUpdateScanner,
} from "../src/core/contracts";
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
    "svm-batch-size": {
      default: 5,
      desc: "getTransaction calls per JSON-RPC batch on SVM chains; public endpoints 429 above ~5",
      type: "number",
    },
  })
  .epilogue(
    "A full 30-day run takes hours and is resumable: interrupt it and re-run the same " +
      "command to continue from the checkpoint file. Chains whose RPC cannot serve the " +
      "whole window are reported as incomplete rather than silently under-counted.",
  );

type Deployment = "legacy" | "upgraded";

/**
 * What a chain's scan positions are counted in. Only ever used for labelling — the scan
 * treats every platform's positions as opaque monotonically increasing integers.
 */
type PositionUnit = "block" | "checkpoint" | "slot";

type ScanBatch = {
  from: number;
  to: number;
  counts: Map<string, number>;
};

type ScanOptions = {
  requestConcurrency: number;
  maxChunkSize: number;
  svmBatchSize: number;
  onRetry: (message: string) => void;
};

/**
 * Per-platform scan mechanics. EVM reads `eth_getLogs`, Sui pages GraphQL events by
 * checkpoint, SVM decodes receiver instructions out of transactions — but all three resolve a
 * position range from the time window and then stream counted sub-ranges of it, so the
 * checkpointing, coverage accounting and reporting are shared.
 */
type TargetScanner = {
  positionUnit: PositionUnit;
  /**
   * SVM signatures are only enumerable newest-first, so its scan closes off the range from the
   * top down while EVM and Sui fill it from the bottom up.
   */
  descending: boolean;
  resolveRange: (state: ReportState) => Promise<{ from: number; to: number }>;
  timestampAt: (position: number) => Promise<number | undefined>;
  stream: (
    range: { from: number; to: number },
    options: ScanOptions,
  ) => AsyncGenerator<ScanBatch>;
};

type ScanTarget = {
  key: string;
  chainId: string;
  address: string;
  deployment: Deployment;
  scanner: TargetScanner;
};

type ScanState = {
  chain: string;
  address: string;
  deployment: Deployment;
  positionUnit: PositionUnit;
  descending: boolean;
  fromPosition: number;
  toPosition: number;
  /**
   * The contiguous sub-range of `[fromPosition, toPosition]` counted so far, inclusive.
   * Undefined until the first batch lands. Ascending scans grow `coveredTo`, descending scans
   * grow `coveredFrom` downwards; the scan is complete when the two ends meet the range.
   */
  coveredFrom?: number;
  coveredTo?: number;
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

function deploymentOf(deploymentType: string | undefined): Deployment {
  return deploymentType === "pro-compatible-production" ? "upgraded" : "legacy";
}

/**
 * The chains that survive the upgrade: mainnets carrying a price feed contract marked
 * `pro-compatible-production`. Both that contract and the chain's legacy Core contract are
 * scanned, since integrators migrate at their own pace and traffic is split across the two.
 *
 * EVM and Sui deployments are derived from `DefaultStore`. SVM is not in the store — it has no
 * `PriceFeedContract` implementation — so its two program pairs come from constants, and it is
 * included only when explicitly listed in `--chains` or when no filter is given.
 */
function getScanTargets(
  chainFilter: string[] | undefined,
  rpcOverrides: Map<string, string>,
): ScanTarget[] {
  const priceFeedContracts = Object.values(DefaultStore.contracts).filter(
    (contract): contract is EvmPriceFeedContract | SuiPriceFeedContract =>
      contract instanceof EvmPriceFeedContract ||
      contract instanceof SuiPriceFeedContract,
  );
  const inScopeChains = new Set(
    priceFeedContracts
      .filter(
        (contract) =>
          contract.deploymentType === "pro-compatible-production" &&
          contract.getChain().isMainnet(),
      )
      .map((contract) => contract.getChain().getId()),
  );
  for (const chainId of svmChainIds()) inScopeChains.add(chainId);

  if (chainFilter !== undefined) {
    for (const chainId of chainFilter) {
      if (!inScopeChains.has(chainId)) {
        throw new Error(
          `${chainId} is not an in-scope chain. In scope: ${[...inScopeChains].sort().join(", ")}`,
        );
      }
    }
  }
  const included = (chainId: string) =>
    inScopeChains.has(chainId) &&
    (chainFilter === undefined || chainFilter.includes(chainId));

  const targets: ScanTarget[] = [];
  for (const contract of priceFeedContracts) {
    const chainId = contract.getChain().getId();
    if (!included(chainId)) continue;
    const rpcOverride = rpcOverrides.get(chainId);
    targets.push(
      contract instanceof EvmPriceFeedContract
        ? evmTarget(contract, rpcOverride)
        : suiTarget(contract),
    );
  }
  for (const chainId of svmChainIds()) {
    if (!included(chainId)) continue;
    targets.push(...svmTargets(chainId, rpcOverrides.get(chainId)));
  }
  return targets.sort((a, b) => a.key.localeCompare(b.key));
}

function svmChainIds(): string[] {
  return Object.values(DefaultStore.chains)
    .filter((chain): chain is SvmChain => chain instanceof SvmChain)
    .filter((chain) => chain.isMainnet())
    .map((chain) => chain.getId());
}

function evmTarget(
  original: EvmPriceFeedContract,
  rpcOverride: string | undefined,
): ScanTarget {
  const contract =
    rpcOverride === undefined ? original : withRpcUrl(original, rpcOverride);
  const chain = contract.getChain();
  return {
    address: contract.address,
    chainId: chain.getId(),
    deployment: deploymentOf(contract.deploymentType),
    key: `${chain.getId()}:${contract.address}`,
    scanner: {
      descending: false,
      positionUnit: "block",
      resolveRange: async (state) => {
        const [from, to] = await Promise.all([
          chain.getBlockNumberAtTimestamp(state.windowStartUnix),
          chain.getBlockNumberAtTimestamp(state.windowEndUnix),
        ]);
        return { from, to };
      },
      stream: (range, options) =>
        mapBatches(
          contract.streamPriceFeedUpdateCounts({
            concurrency: options.requestConcurrency,
            fromBlock: range.from,
            maxChunkSize: options.maxChunkSize,
            onRetry: options.onRetry,
            toBlock: range.to,
          }),
          (batch) => ({
            counts: batch.counts,
            from: batch.fromBlock,
            to: batch.toBlock,
          }),
        ),
      timestampAt: async (position) =>
        Number((await chain.getWeb3().eth.getBlock(position)).timestamp),
    },
  };
}

function suiTarget(contract: SuiPriceFeedContract): ScanTarget {
  const chain = contract.getChain();
  return {
    address: contract.stateId,
    chainId: chain.getId(),
    deployment: deploymentOf(contract.deploymentType),
    key: `${chain.getId()}:${contract.stateId}`,
    scanner: {
      descending: false,
      positionUnit: "checkpoint",
      resolveRange: async (state) => {
        const [from, to] = await Promise.all([
          getSuiCheckpointAtTimestamp(chain, state.windowStartUnix),
          getSuiCheckpointAtTimestamp(chain, state.windowEndUnix),
        ]);
        return { from, to };
      },
      stream: (range, options) =>
        mapBatches(
          contract.streamPriceFeedUpdateCounts({
            fromCheckpoint: range.from,
            onRetry: options.onRetry,
            toCheckpoint: range.to,
          }),
          (batch) => ({
            counts: batch.counts,
            from: batch.fromCheckpoint,
            to: batch.toCheckpoint,
          }),
        ),
      timestampAt: (position) => getSuiCheckpointTimestamp(chain, position),
    },
  };
}

function svmTargets(
  chainId: string,
  rpcOverride: string | undefined,
): ScanTarget[] {
  const stored = DefaultStore.chains[chainId];
  if (!(stored instanceof SvmChain)) {
    throw new Error(`${chainId} is not an SVM chain`);
  }
  const chain =
    rpcOverride === undefined
      ? stored
      : new SvmChain(
          stored.getId(),
          stored.isMainnet(),
          stored.wormholeChainName,
          stored.getNativeToken(),
          rpcOverride,
        );
  return Object.entries(SVM_PRICE_FEED_PROGRAMS).map(
    ([deployment, programs]) => {
      const scanner = new SvmPriceFeedUpdateScanner(chain, programs.receiver);
      return {
        address: programs.receiver,
        chainId,
        deployment: deployment as Deployment,
        key: `${chainId}:${programs.receiver}`,
        scanner: {
          descending: true,
          positionUnit: "slot" as const,
          resolveRange: async (state: ReportState) => {
            const [from, to] = await Promise.all([
              getSvmSlotAtTimestamp(chain, state.windowStartUnix),
              getSvmSlotAtTimestamp(chain, state.windowEndUnix),
            ]);
            return { from, to };
          },
          stream: (range: { from: number; to: number }, options: ScanOptions) =>
            mapBatches(
              scanner.streamPriceFeedUpdateCounts({
                batchSize: options.svmBatchSize,
                fromSlot: range.from,
                onRetry: options.onRetry,
                toSlot: range.to,
              }),
              (batch) => ({
                counts: batch.counts,
                from: batch.fromSlot,
                to: batch.toSlot,
              }),
            ),
          timestampAt: async (position: number) =>
            (await chain.getConnection().getBlockTime(position)) ?? undefined,
        },
      };
    },
  );
}

async function* mapBatches<T>(
  source: AsyncGenerator<T>,
  toBatch: (item: T) => ScanBatch,
): AsyncGenerator<ScanBatch> {
  for await (const item of source) yield toBatch(item);
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
  return scan.toPosition > 0;
}

/** Positions counted so far, whichever end of the range the scan is filling from. */
function positionsScanned(scan: ScanState) {
  if (scan.coveredFrom === undefined || scan.coveredTo === undefined) return 0;
  return scan.coveredTo - scan.coveredFrom + 1;
}

function isFullyCovered(scan: ScanState) {
  return (
    scan.coveredFrom !== undefined &&
    scan.coveredTo !== undefined &&
    scan.coveredFrom <= scan.fromPosition &&
    scan.coveredTo >= scan.toPosition
  );
}

/** The sub-range still to scan, given what a resumed checkpoint already covers. */
function remainingRange(scan: ScanState) {
  if (scan.coveredFrom === undefined || scan.coveredTo === undefined) {
    return { from: scan.fromPosition, to: scan.toPosition };
  }
  return scan.descending
    ? { from: scan.fromPosition, to: scan.coveredFrom - 1 }
    : { from: scan.coveredTo + 1, to: scan.toPosition };
}

function recordBatch(scan: ScanState, batch: ScanBatch) {
  for (const [feedId, count] of batch.counts) {
    scan.counts[feedId] = (scan.counts[feedId] ?? 0) + count;
  }
  scan.coveredFrom = Math.min(scan.coveredFrom ?? batch.from, batch.from);
  scan.coveredTo = Math.max(scan.coveredTo ?? batch.to, batch.to);
}

/**
 * Retries because a single flaky range resolution would otherwise drop a whole chain from the
 * report for the entire run, which reads as "no feeds used here".
 */
async function resolveScanRange(target: ScanTarget, state: ReportState) {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await target.scanner.resolveRange(state);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) throw error;
      console.warn(
        `  [${target.chainId}] resolving ${target.scanner.positionUnit} range attempt ${attempt} failed: ${error}`,
      );
      await sleep(1000 * attempt);
    }
  }
}

async function scanTarget(
  target: ScanTarget,
  scan: ScanState,
  options: {
    requestConcurrency: number;
    maxChunkSize: number;
    svmBatchSize: number;
    onProgress: () => void;
  },
) {
  const range = remainingRange(scan);
  if (range.from <= range.to) {
    for await (const batch of target.scanner.stream(range, {
      maxChunkSize: options.maxChunkSize,
      onRetry: (message) => {
        console.warn(`  [${target.key}] ${message}`);
      },
      requestConcurrency: options.requestConcurrency,
      svmBatchSize: options.svmBatchSize,
    })) {
      recordBatch(scan, batch);
      options.onProgress();
    }
  }
  // A stream can run dry before the range is covered — SVM stops when the endpoint has no
  // more signatures. That is an incomplete scan, not a complete one, and must not be recorded
  // as though the uncovered positions held no updates.
  if (isFullyCovered(scan)) {
    scan.status = "complete";
    delete scan.error;
  } else {
    scan.status = "pending";
    scan.error = `stream ended with ${scan.toPosition - scan.fromPosition + 1 - positionsScanned(scan)} ${scan.positionUnit}s uncovered`;
  }
}

/**
 * Records the wall-clock window the scan actually covered. Without it an incomplete scan is
 * indistinguishable from a feed that genuinely stopped being updated, which is the exact
 * wrong conclusion for this report to support.
 */
async function recordScannedWindow(target: ScanTarget, scan: ScanState) {
  if (scan.coveredFrom === undefined || scan.coveredTo === undefined) return;
  try {
    const [from, through] = await Promise.all([
      target.scanner.timestampAt(scan.coveredFrom),
      target.scanner.timestampAt(scan.coveredTo),
    ]);
    if (from !== undefined) scan.scannedFromUnix = from;
    if (through !== undefined) scan.scannedThroughUnix = through;
  } catch {
    // The endpoint that failed the scan will usually fail this too; the position range in the
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
      "position_unit",
      "from_position",
      "to_position",
      "covered_from_position",
      "covered_to_position",
      "positions_scanned",
      "positions_missing",
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
        // A scan whose range never resolved (dead RPC) has no window to report on, so its
        // position columns stay blank rather than claiming a scanned range of zero.
        const resolved = hasResolvedRange(scan);
        const scanned = positionsScanned(scan);
        const span = scan.toPosition - scan.fromPosition + 1;
        return [
          scan.chain,
          scan.address,
          scan.deployment,
          scan.status,
          scan.positionUnit,
          resolved ? scan.fromPosition : "",
          resolved ? scan.toPosition : "",
          resolved && scanned > 0 ? (scan.coveredFrom ?? "") : "",
          resolved && scanned > 0 ? (scan.coveredTo ?? "") : "",
          scanned,
          resolved ? Math.max(0, span - scanned) : "",
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

  // Position ranges are resolved per chain rather than per contract: the binary search costs
  // ~25 round trips and both of a chain's contracts share the same window.
  const ranges = new Map<string, Promise<{ from: number; to: number }>>();

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
      let scan = state.scans[target.key];
      try {
        // A checkpointed scan whose range never resolved covers nothing, so it is retried
        // from scratch instead of being resumed over an empty range and called complete.
        if (scan === undefined || !hasResolvedRange(scan)) {
          const pending =
            ranges.get(target.chainId) ?? resolveScanRange(target, state);
          ranges.set(target.chainId, pending);
          const { from, to } = await pending;
          scan = {
            address: target.address,
            chain: target.chainId,
            counts: {},
            deployment: target.deployment,
            descending: target.scanner.descending,
            fromPosition: from,
            positionUnit: target.scanner.positionUnit,
            status: "pending",
            toPosition: to,
          };
          state.scans[target.key] = scan;
        }
        if (scan.status === "complete") {
          console.log(`${target.key}: already complete, skipping`);
          return;
        }
        const remaining = remainingRange(scan);
        console.log(
          `${target.key}: scanning ${scan.positionUnit}s ${remaining.from}..${remaining.to}`,
        );
        await scanTarget(target, scan, {
          maxChunkSize: argv["max-chunk-size"],
          onProgress: saveThrottled,
          requestConcurrency: argv["request-concurrency"],
          svmBatchSize: argv["svm-batch-size"],
        });
        console.log(`${target.key}: complete`);
      } catch (error) {
        if (scan === undefined) {
          // The range could not be resolved, so nothing about this contract's window is
          // known. Record it as failed with an empty range so it still shows up in coverage.
          scan = {
            address: target.address,
            chain: target.chainId,
            counts: {},
            deployment: target.deployment,
            descending: target.scanner.descending,
            fromPosition: 0,
            positionUnit: target.scanner.positionUnit,
            status: "failed",
            toPosition: 0,
          };
          state.scans[target.key] = scan;
        }
        scan.status = "failed";
        scan.error = String(error);
        console.error(`${target.key}: FAILED - ${error}`);
      }
      await recordScannedWindow(target, scan);
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
