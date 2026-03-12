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
  "publisher",
  "publicKey",
  "governanceSource",
  "allowedPublisher",
  "signingKey",
];

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

  // Sensitive keyword check
  const lower = content.toLowerCase();
  const found: string[] = [];
  for (const pattern of SENSITIVE_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
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
