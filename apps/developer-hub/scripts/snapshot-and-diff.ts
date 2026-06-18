/**
 * Daily snapshot + diff
 *
 * Atomic steps each daily run performs:
 *
 *   1. Read the rolling baseline at `data/latest-snapshot.json`.
 *   2. Fetch the current symbols catalog from `pyth.dourolabs.app/v1/symbols`.
 *   3. Diff yesterday → today, write the result to
 *      `data/changelog-diffs/<UTC date>.json`.
 *   4. Overwrite the baseline with today's snapshot.
 *
 * Idempotent within a UTC day: if today's diff file already exists the
 * script exits without touching anything (so re-running locally won't
 * corrupt the rolling baseline).
 *
 * On the very first run no baseline exists; the script writes the
 * initial baseline and skips diff generation.
 *
 * Usage:
 *
 *   pnpm snapshot:changelog
 */

/* eslint-disable no-console */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PythSymbol } from "./changelog-lib";
import { diffPair } from "./changelog-lib";

const SYMBOLS_ENDPOINT = "https://pyth.dourolabs.app/v1/symbols";

const utcToday = (): string => {
  const now = new Date();
  return [
    now.getUTCFullYear().toString().padStart(4, "0"),
    (now.getUTCMonth() + 1).toString().padStart(2, "0"),
    now.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
};

const main = async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const dataDir = resolve(here, "../data");
  const baselineFile = resolve(dataDir, "latest-snapshot.json");
  const diffsDir = resolve(dataDir, "changelog-diffs");

  const date = utcToday();
  const todayDiffFile = resolve(diffsDir, `${date}.json`);

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(diffsDir, { recursive: true });

  if (existsSync(todayDiffFile)) {
    console.log(`Diff for ${date} already exists; nothing to do.`);
    return;
  }

  console.log(`Fetching ${SYMBOLS_ENDPOINT}…`);
  const res = await fetch(SYMBOLS_ENDPOINT, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `Symbols API responded with HTTP ${res.status.toString()}: ${res.statusText}`,
    );
  }
  const current = (await res.json()) as unknown;
  if (!Array.isArray(current)) {
    throw new TypeError("Expected the symbols API to return a JSON array");
  }
  const currentSymbols = current as PythSymbol[];

  if (!existsSync(baselineFile)) {
    writeFileSync(baselineFile, `${JSON.stringify(currentSymbols)}\n`, "utf8");
    console.log(
      `No baseline yet — wrote initial baseline (${currentSymbols.length.toString()} symbols). Diff begins tomorrow.`,
    );
    return;
  }

  const previous = JSON.parse(
    readFileSync(baselineFile, "utf8"),
  ) as PythSymbol[];
  const day = diffPair(previous, currentSymbols, date);

  writeFileSync(
    todayDiffFile,
    `${JSON.stringify(day, undefined, 2)}\n`,
    "utf8",
  );
  console.log(
    `Wrote diff for ${date}: ${day.events.length.toString()} event(s) ` +
      `(added ${day.summary.added.toString()}, went_live ${day.summary.went_live.toString()}, ` +
      `removed ${day.summary.removed.toString()}) → ${todayDiffFile}`,
  );

  writeFileSync(baselineFile, `${JSON.stringify(currentSymbols)}\n`, "utf8");
  console.log("Baseline updated.");
};

main().catch((error: unknown) => {
  console.error(error);
  throw error;
});
