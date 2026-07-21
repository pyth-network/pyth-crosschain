/**
 * Price Feeds Snapshot Generator
 *
 * Fetches the Hermes (Core), Hermes-beta (Core), and Lazer (Pro) feed lists at
 * build time and writes them to `src/generated/price-feeds.json`. The docs
 * search route (`src/app/api/search/route.ts`) imports that snapshot
 * synchronously instead of fetching ~6 MB across three external APIs on every
 * cold-start lambda.
 *
 * ## Usage
 *
 * Runs automatically during the build. To run it manually:
 *
 * ```bash
 * pnpm generate:price-feeds
 * ```
 *
 * ## Best-effort semantics
 *
 * A source that fails to fetch or validate is skipped with a warning and falls
 * back to the previously-generated snapshot (or an empty set on a cold build).
 * This script never throws — the build must not fail because an upstream API is
 * down.
 */

import * as fs from "node:fs/promises";
import path from "node:path";

import {
  hermesSchema,
  lazerSchema,
  type HermesFeed,
  type LazerFeed,
  type PriceFeedsSnapshot,
} from "../src/app/api/search/feed-schemas";
import { SYMBOLS_API_URL } from "../src/config/pyth-pro-public";

const OUTPUT_PATH = "./src/generated/price-feeds.json";

async function readPreviousSnapshot(): Promise<Partial<PriceFeedsSnapshot>> {
  try {
    return JSON.parse(
      await fs.readFile(OUTPUT_PATH, "utf8"),
    ) as PriceFeedsSnapshot;
  } catch {
    return {};
  }
}

async function fetchHermes(url: string): Promise<HermesFeed[]> {
  const res = await fetch(new URL("/v2/price_feeds", url));
  const parsed = hermesSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new Error(`invalid response from ${url}`);
  }
  return parsed.data;
}

async function fetchLazer(): Promise<LazerFeed[]> {
  const res = await fetch(SYMBOLS_API_URL);
  const parsed = lazerSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new Error(`invalid response from ${SYMBOLS_API_URL}`);
  }
  return parsed.data;
}

async function fetchSource<T>(
  label: string,
  fetcher: () => Promise<T[]>,
  previous: T[] | undefined,
): Promise<T[]> {
  try {
    const data = await fetcher();
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${label}: ${String(data.length)} feeds`);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.warn(
      `  ⚠ ${label}: fetch failed (${message}); using ${String(previous?.length ?? 0)} cached feeds`,
    );
    return previous ?? [];
  }
}

async function writeSnapshot(snapshot: PriceFeedsSnapshot): Promise<void> {
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(snapshot, undefined, 2) + "\n");
}

// Guarantees the route's static-import target exists even if generation blew up
// before the normal write, so a cold build never fails on a missing file.
async function ensureSnapshotFile(): Promise<void> {
  try {
    await fs.access(OUTPUT_PATH);
  } catch {
    await writeSnapshot({ hermes: [], hermesBeta: [], lazer: [] });
  }
}

async function generatePriceFeedsSnapshot(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("Generating price feeds snapshot...\n");

  const previous = await readPreviousSnapshot();

  const [hermes, hermesBeta, lazer] = await Promise.all([
    fetchSource(
      "hermes",
      () => fetchHermes("https://hermes.pyth.network"),
      previous.hermes,
    ),
    fetchSource(
      "hermes-beta",
      () => fetchHermes("https://hermes-beta.pyth.network"),
      previous.hermesBeta,
    ),
    fetchSource("lazer", fetchLazer, previous.lazer),
  ]);

  await writeSnapshot({ hermes, hermesBeta, lazer });

  // eslint-disable-next-line no-console
  console.log(`\n✓ Wrote ${OUTPUT_PATH}`);
}

try {
  await generatePriceFeedsSnapshot();
} catch (error) {
  // Snapshot generation is best-effort: the previously-committed (or empty)
  // snapshot is sufficient for the build. Never fail the build on this script.
  const message = error instanceof Error ? error.stack ?? error.message : error;
  // eslint-disable-next-line no-console
  console.warn("\n⚠ Price feeds snapshot generation failed, continuing anyway:");
  // eslint-disable-next-line no-console
  console.warn(message);
  await ensureSnapshotFile();
}
