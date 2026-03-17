/**
 * LLM Token Counter
 *
 * Counts tokens for all llm.txt and SKILL.md route files using cl100k_base encoding.
 * Outputs token counts, byte sizes, and SHA-256 content hashes to src/data/llm-token-counts.json.
 *
 * ## Usage
 *
 * ```bash
 * pnpm count:llm-tokens
 * ```
 *
 * ## How It Works
 *
 * Reads each route file, extracts the CONTENT template literal,
 * then counts tokens using js-tiktoken (cl100k_base encoding, same as GPT-4/GPT-4o).
 *
 * Token counts are approximate — actual counts vary by model and tokenizer.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getEncoding } from "js-tiktoken";

import { LLM_FILES } from "../src/data/llm-files";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "src", "data", "llm-token-counts.json");

/**
 * Extract static content from a route file's template literal.
 *
 * Matches `const CONTENT = \`...\`;` at module level.
 */
function extractContent(source: string): string {
  const match = source.match(/const\s+CONTENT\s*=\s*`([\s\S]*?)`;/);
  if (match?.[1]) {
    return match[1].replace(/\\`/g, "`").replace(/\\\$/g, "$");
  }
  throw new Error("Could not extract CONTENT from route file");
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function main() {
  const enc = getEncoding("cl100k_base");

  const files: Record<string, { tokens: number; bytes: number; hash: string }> =
    {};

  for (const file of LLM_FILES) {
    const routePath = path.join(ROOT, file.routeFile);
    const source = await readFile(routePath, "utf8");

    try {
      const content = extractContent(source);
      const tokens = enc.encode(content).length;
      const bytes = Buffer.byteLength(content, "utf8");
      const hash = `sha256:${sha256(content)}`;

      files[file.path] = { bytes, hash, tokens };
    } catch {
      // Skip files that don't have CONTENT template literals
    }
  }

  const output = {
    files,
    generated_at: new Date().toISOString(),
    tokenizer: "cl100k_base",
    tokenizer_note:
      "Token counts are approximate. Actual counts vary by model.",
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
}

main().catch((_err) => {
  process.exit(1);
});
