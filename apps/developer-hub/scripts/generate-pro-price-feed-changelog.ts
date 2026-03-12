/**
 * CLI entrypoint: generates daily-rollups.json from the governance repo.
 *
 * Usage:
 *   GOVERNANCE_REPO_PATH=/path/to/clone pnpm run generate:pro-price-feed-changelog
 *
 * Environment variables:
 *   GOVERNANCE_REPO_PATH — local path to pyth-lazer-governance checkout (required)
 *   FULL_REBUILD         — set to "true" to ignore existing rollup and rebuild from scratch
 */

import * as fs from "node:fs/promises";
import path from "node:path";

import type { DailyRollupFile } from "../src/data/pro-price-feed-changelog/types";
import {
  checkShrinkage,
  diffStates,
  groupByDate,
  listProposalDirs,
  loadAfterFeeds,
  loadExistingRollup,
  transformFeeds,
} from "./lib/pro-price-feed-changelog";

const SOURCE = "pyth-network/pyth-lazer-governance";
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const ROLLUPS_PATH = path.join(
  SCRIPT_DIR,
  "..",
  "public",
  "data",
  "pro-price-feed-changelog",
  "daily-rollups.json",
);

async function main() {
  const repoPath = process.env.GOVERNANCE_REPO_PATH;
  if (!repoPath) {
    console.error(
      "Error: GOVERNANCE_REPO_PATH environment variable is required.\n" +
        "Set it to the local path of the pyth-lazer-governance checkout.",
    );
    process.exit(1);
  }

  // Verify the path exists and is a directory
  try {
    const stat = await fs.stat(repoPath);
    if (!stat.isDirectory()) {
      console.error(`Error: GOVERNANCE_REPO_PATH is not a directory: ${repoPath}`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: GOVERNANCE_REPO_PATH does not exist: ${repoPath}`);
    process.exit(1);
  }

  const fullRebuild = process.env.FULL_REBUILD === "true";

  // 1. List and group proposal dirs by date
  const dirs = await listProposalDirs(repoPath);
  console.log(`Found ${String(dirs.length)} proposal directories.`);

  const dateToDir = groupByDate(dirs);
  const sortedDates = [...dateToDir.keys()].sort();
  console.log(`Grouped into ${String(sortedDates.length)} unique dates.`);

  if (sortedDates.length === 0) {
    console.log("No proposals found. Nothing to generate.");
    return;
  }

  // 2. Load existing rollup (unless full rebuild)
  await fs.mkdir(path.dirname(ROLLUPS_PATH), { recursive: true });
  const existing =
    !fullRebuild ? await loadExistingRollup(ROLLUPS_PATH) : null;
  const existingDates = new Set(existing?.days.map((d) => d.date) ?? []);

  // 3. Determine which dates need processing
  const datesToProcessSet = new Set(
    sortedDates.filter((d) => !existingDates.has(d)),
  );
  console.log(
    `${String(datesToProcessSet.size)} new date(s) to process${fullRebuild ? " (full rebuild)" : ""}.`,
  );

  // 4. Load and transform feeds for each date, then diff consecutive pairs.
  //    Cache the previous date's transformed feeds to avoid redundant I/O.
  const newDays = [];
  let cachedPublic: { date: string; feeds: ReturnType<typeof transformFeeds> } | null = null;

  for (let i = 0; i < sortedDates.length; i++) {
    const currentDate = sortedDates[i];
    if (!currentDate) continue;
    if (!datesToProcessSet.has(currentDate)) {
      // Invalidate cache — the next new date needs to re-load this date's feeds
      cachedPublic = null;
      continue;
    }

    const currDir = dateToDir.get(currentDate);
    if (!currDir) continue;

    // Find the previous date in the sequence
    const prevDate = i > 0 ? sortedDates[i - 1] : undefined;

    try {
      // Load previous date's feeds — use cache if available
      let prevPublic: ReturnType<typeof transformFeeds>;
      if (!prevDate) {
        prevPublic = [];
      } else if (cachedPublic?.date === prevDate) {
        prevPublic = cachedPublic.feeds;
      } else {
        const prevDir = dateToDir.get(prevDate);
        if (!prevDir) {
          cachedPublic = null;
          continue;
        }
        const prevRaw = await loadAfterFeeds(repoPath, prevDir);
        prevPublic = transformFeeds(prevRaw);
      }

      // Load current date's feeds
      const currRaw = await loadAfterFeeds(repoPath, currDir);
      const currPublic = transformFeeds(currRaw);

      const day = diffStates(currentDate, prevPublic, currPublic);
      if (day.changes.length > 0) {
        newDays.push(day);
      }

      // Cache current feeds for the next iteration
      cachedPublic = { date: currentDate, feeds: currPublic };

      const label = !prevDate
        ? `${String(currPublic.length)} feeds (first snapshot, ${String(day.changes.length)} added)`
        : `${String(day.changes.length)} change(s)`;
      console.log(`  ${currentDate}: ${label}`);
    } catch (error: unknown) {
      cachedPublic = null;
      const code =
        error instanceof Error ? error.message.slice(0, 80) : "unknown";
      console.error(`  ${currentDate}: failed — ${code}`);
    }
  }

  // 5. Merge new days into existing rollup
  const mergedDays = fullRebuild
    ? newDays
    : [...(existing?.days ?? []), ...newDays];

  // Sort by date descending (newest first)
  mergedDays.sort((a, b) => b.date.localeCompare(a.date));

  const proposed: DailyRollupFile = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    days: mergedDays,
  };

  // 6. Shrinkage guard
  if (existing && !fullRebuild) {
    checkShrinkage(existing, proposed);
  }

  // 7. Write output
  await fs.writeFile(ROLLUPS_PATH, `${JSON.stringify(proposed)}\n`);
  console.log(
    `\nDone. ${String(proposed.days.length)} day(s) in rollup, ${String(newDays.length)} new.`,
  );
}

await main();
