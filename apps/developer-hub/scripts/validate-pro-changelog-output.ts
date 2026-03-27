/**
 * Validates daily-rollups.json against the canonical schema and checks
 * for sensitive keywords that should never appear in public output.
 *
 * Usage: pnpm tsx ./scripts/validate-pro-changelog-output.ts
 */

import * as fs from "node:fs/promises";
import path from "node:path";

import { dailyRollupFileSchema } from "../src/data/pro-price-feed-changelog/types";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const ROLLUPS_PATH = path.join(
  SCRIPT_DIR,
  "..",
  "public",
  "data",
  "pro-price-feed-changelog",
  "daily-rollups.json",
);

const SENSITIVE_PATTERNS = [
  "hermes_id",
  "publickey",
  "governancesource",
  "allowedpublisher",
  "signingkey",
  "privatekey",
  "secret",
  "credential",
  "apikey",
  "auth_token",
  "encryption",
] as const;

/** Keys that are allowed in the output JSON — anything else is suspicious. */
const ALLOWED_KEYS = new Set([
  "generatedAt",
  "source",
  "days",
  "date",
  "totals",
  "went_live",
  "added",
  "changed",
  "removed",
  "changes",
  "changeType",
  "pythLazerId",
  "symbol",
  "name",
  "statusBefore",
  "statusAfter",
  "changedFields",
  "path",
  "before",
  "after",
]);

function collectKeys(value: unknown, keys: Set<string>): void {
  if (typeof value !== "object" || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }
}

async function main() {
  const content = await fs.readFile(ROLLUPS_PATH, "utf8");
  const data = JSON.parse(content) as unknown;

  // Strict schema validation
  const result = dailyRollupFileSchema.strict().safeParse(data);
  if (!result.success) {
    console.error("Schema validation failed:");
    console.error(result.error.format());
    process.exit(1);
  }

  console.log(
    `Schema OK: ${String(result.data.days.length)} day(s) in rollup.`,
  );

  // Structural key check — flag any unexpected keys in the output
  const allKeys = new Set<string>();
  collectKeys(data, allKeys);
  const unexpectedKeys = [...allKeys].filter((k) => !ALLOWED_KEYS.has(k));
  if (unexpectedKeys.length > 0) {
    console.error(
      `Unexpected key(s) found in output: ${unexpectedKeys.join(", ")}`,
    );
    process.exit(1);
  }

  console.log("Structural key check passed.");

  // Sensitive keyword check on raw content (defense-in-depth)
  const lower = content.toLowerCase();
  const found: string[] = [];
  for (const pattern of SENSITIVE_PATTERNS) {
    if (lower.includes(pattern)) {
      found.push(pattern);
    }
  }

  if (found.length > 0) {
    console.error(
      `Sensitive keyword(s) found in output: ${found.join(", ")}`,
    );
    process.exit(1);
  }

  console.log("Sensitive keyword check passed.");
}

await main();
