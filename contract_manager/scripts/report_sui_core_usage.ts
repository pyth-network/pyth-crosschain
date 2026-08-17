/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */

/**
 * Reports who is still writing to the Pyth Core price feed contracts on Sui mainnet, split by
 * the address that sent each update. The legacy Core contract is being switched off as part of
 * the Core -> Pro migration, and the question that decides when it can go is how much of the
 * traffic left on it comes from integrators rather than from the Pyth price pusher, which
 * keeps both the legacy and the pro-compatible deployment fed and would otherwise mask the
 * answer entirely.
 *
 * Usage: `pnpm tsx scripts/report_sui_core_usage.ts --days 7`
 *
 * A count here is one `PriceFeedUpdateEvent`, which `update_cache` emits only for a *fresh*
 * update, so the numbers are accepted writes rather than `update_price_feeds` calls. A
 * consumer that only reads a feed emits nothing and relies on somebody else pushing, so treat
 * "any updates at all from an address" as the in-use signal and the count as a magnitude hint.
 *
 * The window is scanned one 24-hour bucket at a time rather than in one span, which is what
 * makes the daily trend exact — the point of the report is whether non-pusher traffic on the
 * legacy contract is heading to zero, and a trend interpolated across chunk boundaries would
 * not support that. Buckets are checkpointed individually, so an interrupted run resumes
 * where it stopped: a 7-day scan is tens of thousands of requests against an endpoint that
 * caps out around 22 per second.
 */

import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { SuiChain } from "../src/core/chains";
import {
  getSuiCheckpointAtTimestamp,
  getSuiCheckpointTimestamp,
  SuiPriceFeedContract,
} from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";
import { writeCsv } from "../src/utils/csv";

/**
 * Wallet the Pyth price pusher signs Sui mainnet updates with. Both the legacy and the
 * pro-compatible deployments mount the same `sui-price-pusher` keypair, so one address covers
 * both. Confirmed against mainnet rather than derived: over a 30-minute window this address
 * updated exactly the 37 feeds in the legacy pusher's `price-config-0.yaml` and exactly the 20
 * feeds enabled in `price-config-pro-compatible.yaml`, and no other address came close.
 */
const SUI_PRICE_PUSHER_ADDRESS =
  "0x02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331";

const SECONDS_PER_DAY = 24 * 60 * 60;

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --days 7 --output sui_core_usage.csv")
  .options({
    "chunk-size": {
      default: 2000,
      desc: "Checkpoints covered by a single GraphQL events filter window",
      type: "number",
    },
    days: {
      default: 7,
      desc: "Size of the lookback window in days; also the number of daily buckets",
      type: "number",
    },
    deployments: {
      choices: ["legacy", "upgraded"] as const,
      default: ["legacy", "upgraded"],
      desc: "Which Sui mainnet deployments to scan",
      type: "array",
    },
    fresh: {
      default: false,
      desc: "Ignore any existing checkpoint file and scan the window from scratch",
      type: "boolean",
    },
    output: {
      default: "sui_core_usage.csv",
      desc: "Path of the per-sender CSV; the daily CSV is written alongside it",
      type: "string",
    },
    pusher: {
      default: [SUI_PRICE_PUSHER_ADDRESS],
      desc: "Addresses to attribute to the Pyth price pusher and exclude from integrator usage",
      string: true,
      type: "array",
    },
    "request-concurrency": {
      default: 8,
      desc: "GraphQL filter windows in flight; the public endpoint 429s above ~22 requests/second",
      type: "number",
    },
    "state-file": {
      default: "sui_core_usage_state.json",
      desc: "Checkpoint file; a run resumes from it unless --fresh is passed",
      type: "string",
    },
  })
  .epilogue(
    "A 7-day run is tens of thousands of GraphQL requests and takes tens of minutes. It is " +
      "resumable: interrupt it and re-run the same command to continue from the checkpoint file.",
  );

type Deployment = "legacy" | "upgraded";

/** One 24-hour slice of one deployment's scan, checkpointed independently of the others. */
type BucketState = {
  deployment: Deployment;
  /** 0 is the oldest bucket in the window. */
  day: number;
  startUnix: number;
  endUnix: number;
  fromCheckpoint: number;
  toCheckpoint: number;
  /** Highest checkpoint counted so far; undefined until the first batch lands. */
  coveredTo?: number;
  senderCounts: Record<string, number>;
};

type ReportState = {
  days: number;
  windowStartUnix: number;
  windowEndUnix: number;
  /** Checkpoint each bucket boundary resolved to, oldest first; `days + 1` entries. */
  boundaryCheckpoints: number[];
  buckets: Record<string, BucketState>;
};

function bucketKey(deployment: Deployment, day: number) {
  return `${deployment}:${String(day)}`;
}

function deploymentOf(contract: SuiPriceFeedContract): Deployment {
  return contract.deploymentType === "pro-compatible-production"
    ? "upgraded"
    : "legacy";
}

function getSuiMainnetContracts(
  deployments: readonly Deployment[],
): Map<Deployment, SuiPriceFeedContract> {
  const contracts = new Map<Deployment, SuiPriceFeedContract>();
  for (const contract of Object.values(DefaultStore.contracts)) {
    if (!(contract instanceof SuiPriceFeedContract)) continue;
    if (!contract.getChain().isMainnet()) continue;
    const deployment = deploymentOf(contract);
    if (!deployments.includes(deployment)) continue;
    if (contracts.has(deployment)) {
      throw new Error(
        `Sui mainnet has more than one ${deployment} price feed contract`,
      );
    }
    contracts.set(deployment, contract);
  }
  for (const deployment of deployments) {
    if (!contracts.has(deployment)) {
      throw new Error(`Sui mainnet has no ${deployment} price feed contract`);
    }
  }
  return contracts;
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
      `${stateFile} checkpoints a ${String(state.days)}-day window but --days is ${String(days)}. ` +
        "Pass --fresh to restart, or --state-file to keep both runs.",
    );
  }
  return state;
}

/**
 * Resolves the checkpoint each daily boundary falls on. The boundaries are shared by both
 * deployments, and each one costs a ~28-request binary search, so they are resolved once and
 * checkpointed with the rest of the state.
 */
function resolveBoundaries(
  chain: SuiChain,
  state: ReportState,
): Promise<number[]> {
  const timestamps = Array.from(
    { length: state.days + 1 },
    (_, index) => state.windowStartUnix + index * SECONDS_PER_DAY,
  );
  return Promise.all(
    timestamps.map((timestamp) =>
      getSuiCheckpointAtTimestamp(chain, timestamp),
    ),
  );
}

async function scanBucket(
  contract: SuiPriceFeedContract,
  bucket: BucketState,
  options: { chunkSize: number; concurrency: number; onProgress: () => void },
) {
  const from =
    bucket.coveredTo === undefined
      ? bucket.fromCheckpoint
      : bucket.coveredTo + 1;
  if (from > bucket.toCheckpoint) return;
  const stream = contract.streamPriceFeedUpdateCounts({
    chunkSize: options.chunkSize,
    concurrency: options.concurrency,
    fromCheckpoint: from,
    onRetry: (message) => {
      console.warn(`  ${message}`);
    },
    toCheckpoint: bucket.toCheckpoint,
  });
  for await (const batch of stream) {
    for (const [sender, count] of batch.senderCounts) {
      bucket.senderCounts[sender] = (bucket.senderCounts[sender] ?? 0) + count;
    }
    bucket.coveredTo = batch.toCheckpoint;
    options.onProgress();
  }
}

function isComplete(bucket: BucketState) {
  return (
    bucket.coveredTo !== undefined && bucket.coveredTo >= bucket.toCheckpoint
  );
}

type BucketTotals = {
  total: number;
  pusher: number;
  other: number;
  otherSenders: number;
};

function totalsOf(bucket: BucketState, pushers: Set<string>): BucketTotals {
  let pusher = 0;
  let other = 0;
  let otherSenders = 0;
  for (const [sender, count] of Object.entries(bucket.senderCounts)) {
    if (pushers.has(sender)) {
      pusher += count;
    } else {
      other += count;
      otherSenders += 1;
    }
  }
  return { other, otherSenders, pusher, total: pusher + other };
}

function toUtc(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString();
}

function writeReport(
  outputPath: string,
  state: ReportState,
  pushers: Set<string>,
) {
  const buckets = Object.values(state.buckets).sort(
    (a, b) => a.day - b.day || a.deployment.localeCompare(b.deployment),
  );

  const dailyRows: (string | number)[][] = [
    [
      "window_start",
      "window_end",
      "deployment",
      "complete",
      "total_updates",
      "price_pusher_updates",
      "other_updates",
      "other_senders",
    ],
  ];
  for (const bucket of buckets) {
    const totals = totalsOf(bucket, pushers);
    dailyRows.push([
      toUtc(bucket.startUnix),
      toUtc(bucket.endUnix),
      bucket.deployment,
      String(isComplete(bucket)),
      totals.total,
      totals.pusher,
      totals.other,
      totals.otherSenders,
    ]);
  }

  const bySender = new Map<string, Map<Deployment, number>>();
  for (const bucket of buckets) {
    for (const [sender, count] of Object.entries(bucket.senderCounts)) {
      const perDeployment =
        bySender.get(sender) ?? new Map<Deployment, number>();
      bySender.set(sender, perDeployment);
      perDeployment.set(
        bucket.deployment,
        (perDeployment.get(bucket.deployment) ?? 0) + count,
      );
    }
  }
  const senderRows: (string | number)[][] = [
    [
      "sender",
      "is_price_pusher",
      "total_updates",
      "legacy_updates",
      "upgraded_updates",
    ],
  ];
  const ranked = [...bySender.entries()]
    .map(([sender, perDeployment]) => {
      const legacy = perDeployment.get("legacy") ?? 0;
      const upgraded = perDeployment.get("upgraded") ?? 0;
      return { legacy, sender, total: legacy + upgraded, upgraded };
    })
    .sort((a, b) => b.total - a.total);
  for (const row of ranked) {
    senderRows.push([
      row.sender,
      String(pushers.has(row.sender)),
      row.total,
      row.legacy,
      row.upgraded,
    ]);
  }

  const dailyPath = outputPath.replace(/(\.csv)?$/, "_daily.csv");
  writeCsv(outputPath, senderRows);
  writeCsv(dailyPath, dailyRows);
  return { dailyPath, ranked };
}

function printSummary(state: ReportState, pushers: Set<string>) {
  for (const deployment of ["legacy", "upgraded"] as const) {
    const buckets = Object.values(state.buckets)
      .filter((bucket) => bucket.deployment === deployment)
      .sort((a, b) => a.day - b.day);
    if (buckets.length === 0) continue;
    console.log(`\n${deployment} contract, updates per day (UTC):`);
    console.log(
      "  day                        total    pusher     other   senders",
    );
    for (const bucket of buckets) {
      const totals = totalsOf(bucket, pushers);
      const flag = isComplete(bucket) ? "" : "  INCOMPLETE";
      console.log(
        `  ${toUtc(bucket.startUnix)}  ${String(totals.total).padStart(8)}  ${String(totals.pusher).padStart(8)}  ${String(totals.other).padStart(8)}  ${String(totals.otherSenders).padStart(8)}${flag}`,
      );
    }
    const totals = buckets.map((bucket) => totalsOf(bucket, pushers));
    const sum = (pick: (totals: BucketTotals) => number) =>
      totals.reduce((accumulator, item) => accumulator + pick(item), 0);
    const total = sum((item) => item.total);
    const other = sum((item) => item.other);
    const share = total === 0 ? 0 : (100 * other) / total;
    console.log(
      `  window total ${String(total)}, price pusher ${String(sum((item) => item.pusher))}, ` +
        `other ${String(other)} (${share.toFixed(2)}% of updates)`,
    );
  }
}

async function main() {
  const argv = await parser.argv;
  const deployments = [...new Set(argv.deployments)] as Deployment[];
  const contracts = getSuiMainnetContracts(deployments);
  const chain = [...contracts.values()][0]?.getChain();
  if (chain === undefined) throw new Error("No Sui mainnet contracts selected");

  const existingState = argv.fresh
    ? undefined
    : await loadState(argv["state-file"], argv.days);
  const nowUnix = Math.floor(Date.now() / 1000);
  const state: ReportState = existingState ?? {
    boundaryCheckpoints: [],
    buckets: {},
    days: argv.days,
    windowEndUnix: nowUnix,
    windowStartUnix: nowUnix - argv.days * SECONDS_PER_DAY,
  };
  const save = () => {
    writeFileSync(argv["state-file"], JSON.stringify(state));
  };

  console.log(
    `Scanning Sui mainnet ${deployments.join(", ")} over ${toUtc(state.windowStartUnix)} .. ${toUtc(state.windowEndUnix)}`,
  );
  if (state.boundaryCheckpoints.length === 0) {
    state.boundaryCheckpoints = await resolveBoundaries(chain, state);
    save();
  }
  const boundaries = state.boundaryCheckpoints;
  console.log(
    `Checkpoints ${String(boundaries[0])} .. ${String(boundaries.at(-1))}`,
  );

  let lastSaveMs = 0;
  const saveThrottled = () => {
    const SAVE_INTERVAL_MS = 5000;
    if (Date.now() - lastSaveMs < SAVE_INTERVAL_MS) return;
    lastSaveMs = Date.now();
    save();
  };

  for (const deployment of deployments) {
    const contract = contracts.get(deployment);
    if (contract === undefined) continue;
    for (let day = 0; day < argv.days; day++) {
      const key = bucketKey(deployment, day);
      const bucket = (state.buckets[key] ??= {
        day,
        deployment,
        endUnix: state.windowStartUnix + (day + 1) * SECONDS_PER_DAY,
        // Boundaries are the first checkpoint at or after each day start, so the bucket ends
        // one checkpoint below the next boundary and the buckets tile the window exactly.
        fromCheckpoint: boundaries[day] ?? 0,
        senderCounts: {},
        startUnix: state.windowStartUnix + day * SECONDS_PER_DAY,
        toCheckpoint: (boundaries[day + 1] ?? 0) - 1,
      });
      if (isComplete(bucket)) {
        console.log(`${key}: already complete, skipping`);
        continue;
      }
      console.log(
        `${key}: scanning checkpoints ${String(bucket.coveredTo === undefined ? bucket.fromCheckpoint : bucket.coveredTo + 1)}..${String(bucket.toCheckpoint)}`,
      );
      await scanBucket(contract, bucket, {
        chunkSize: argv["chunk-size"],
        concurrency: argv["request-concurrency"],
        onProgress: saveThrottled,
      });
      save();
    }
  }

  const pushers = new Set(argv.pusher);
  const report = writeReport(argv.output, state, pushers);
  printSummary(state, pushers);
  console.log(
    `\nWrote ${String(report.ranked.length)} senders to ${argv.output} and ${String(Object.keys(state.buckets).length)} daily rows to ${report.dailyPath}`,
  );

  const checkpointTimestamps = await Promise.all(
    [boundaries[0] ?? 0, boundaries.at(-1) ?? 0].map((checkpoint) =>
      getSuiCheckpointTimestamp(chain, checkpoint),
    ),
  );
  console.log(
    `Checkpoint window actually covers ${checkpointTimestamps
      .map((timestamp) => (timestamp === undefined ? "?" : toUtc(timestamp)))
      .join(" .. ")}`,
  );
}

await main();
