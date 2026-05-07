/**
 * Daily Symbol Snapshot
 *
 * Fetches the public symbols catalog from pyth.dourolabs.app and writes it
 * to `data/changelog-snapshots/<UTC date>.json`. Intended to run from a
 * daily GitHub Action; safe to run locally for ad-hoc captures.
 *
 * Usage:
 *
 *   pnpm snapshot:changelog
 *
 * The script is idempotent within a single UTC day: re-running overwrites
 * today's file with the latest API response.
 */

/* eslint-disable no-console */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  console.log(`Fetching ${SYMBOLS_ENDPOINT}…`);
  const res = await fetch(SYMBOLS_ENDPOINT, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `Symbols API responded with HTTP ${res.status.toString()}: ${res.statusText}`,
    );
  }

  const payload = (await res.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new TypeError("Expected the symbols API to return a JSON array");
  }

  const date = utcToday();
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(here, "../data/changelog-snapshots");
  const outFile = resolve(outDir, `${date}.json`);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(payload, undefined, 2)}\n`, "utf8");

  console.log(
    `Wrote snapshot for ${date}: ${payload.length.toString()} symbols → ${outFile}`,
  );
};

main().catch((error: unknown) => {
  console.error(error);
  throw error;
});
