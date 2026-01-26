/* eslint-disable no-console */
/**
 * LLM Token Counting Validation Script
 *
 * Compares token counts between the old monolithic approach (llms-full.txt = all pages)
 * and the new product-specific approach (hub + individual product files).
 *
 * Usage:
 *   pnpm count:llm-tokens
 */

import * as fs from "node:fs/promises";
import path from "node:path";

import { remarkInclude } from "fumadocs-mdx/config";
import { encodingForModel } from "js-tiktoken";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";

const encoder = encodingForModel("gpt-4o");

const processor = remark()
  .use(remarkMath)
  .use(remarkMdx)
  .use(remarkInclude)
  .use(remarkGfm);

const CONTENT_DIR = path.join(process.cwd(), "content", "docs");

// --- Utility functions ---

function countTokens(text: string): number {
  return encoder.encode(text).length;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

// --- MDX file discovery ---

type MdxPage = {
  /** Absolute path to the MDX file */
  filePath: string;
  /** URL path derived from file location, e.g. "/price-feeds/core/getting-started" */
  urlPath: string;
  /** Title extracted from frontmatter */
  title: string;
};

async function findMdxFiles(dir: string, baseUrl = ""): Promise<MdxPage[]> {
  const pages: MdxPage[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      pages.push(...(await findMdxFiles(fullPath, `${baseUrl}/${entry.name}`)));
    } else if (entry.name.endsWith(".mdx")) {
      const baseName = entry.name.replace(/\.mdx$/, "");
      const urlPath =
        baseName === "index" ? baseUrl || "/" : `${baseUrl}/${baseName}`;

      const content = await fs.readFile(fullPath, "utf8");
      const title = extractTitle(content) ?? baseName;

      pages.push({ filePath: fullPath, urlPath, title });
    }
  }

  return pages;
}

function extractTitle(content: string): string | undefined {
  const match = /^---\s*\n[\s\S]*?^title:\s*["']?(.+?)["']?\s*$/m.exec(content);
  return match?.[1];
}

// --- Process MDX to plain text (same pipeline as getLLMText) ---

async function processPage(page: MdxPage): Promise<string> {
  const raw = await fs.readFile(page.filePath, "utf8");
  const processed = await processor.process({
    path: page.filePath,
    value: raw,
  });

  return `# ${page.title}
URL: ${page.urlPath}

${String(processed.value)}`;
}

// --- Product endpoint definitions ---

const PRODUCT_ENDPOINTS: Record<string, { label: string; paths: string[] }> = {
  "llms-price-feeds.txt": {
    label: "Price Feeds (All)",
    paths: ["/price-feeds", "/api-reference/pyth-core"],
  },
  "llms-price-feeds-core.txt": {
    label: "Price Feeds (Core)",
    paths: ["/price-feeds/core", "/api-reference/pyth-core"],
  },
  "llms-price-feeds-pro.txt": {
    label: "Price Feeds (Pro)",
    paths: ["/price-feeds/pro"],
  },
  "llms-entropy.txt": {
    label: "Entropy",
    paths: ["/entropy", "/api-reference/entropy"],
  },
};

// Static header approximate token counts (from the route files)
const STATIC_HEADER_SIZES: Record<string, string> = {};

// Read static headers from the actual route files
async function loadStaticHeaders(): Promise<void> {
  const routeDir = path.join(process.cwd(), "src", "app");
  for (const endpoint of Object.keys(PRODUCT_ENDPOINTS)) {
    const routeFile = path.join(
      routeDir,
      endpoint.replace(".txt", ".txt"),
      "route.ts",
    );
    try {
      const content = await fs.readFile(routeFile, "utf8");
      // Extract the STATIC_HEADER template literal content
      const match = /const STATIC_HEADER = `([\s\S]*?)`;/m.exec(content);
      if (match?.[1]) {
        STATIC_HEADER_SIZES[endpoint] = match[1];
      }
    } catch {
      // Route file might not exist yet, use empty
      STATIC_HEADER_SIZES[endpoint] = "";
    }
  }
}

// Hub content from llms.txt route
async function loadHubContent(): Promise<string> {
  const routeFile = path.join(
    process.cwd(),
    "src",
    "app",
    "llms.txt",
    "route.ts",
  );
  const content = await fs.readFile(routeFile, "utf8");
  const match = /const content = `([\s\S]*?)`;/m.exec(content);
  return match?.[1] ?? "";
}

// --- Main ---

async function main() {
  console.log("Counting LLM tokens...\n");
  console.log("Encoding: cl100k_base (GPT-4o compatible)\n");

  // Discover all MDX pages
  const allPages = await findMdxFiles(CONTENT_DIR);
  console.log(`Found ${String(allPages.length)} MDX pages in content/docs/\n`);

  // Load static headers from route files
  await loadStaticHeaders();
  const hubContent = await loadHubContent();
  const hubTokens = countTokens(hubContent);

  // Process all pages (needed for full dump + product filtering)
  console.log("Processing all pages with remark pipeline...");
  const processedPages = await Promise.all(
    allPages.map(async (page) => ({
      page,
      text: await processPage(page),
    })),
  );
  console.log("Done.\n");

  // --- Old approach: llms-full.txt (all pages) ---
  const fullDumpContent = [
    "# Pyth Network - Complete Documentation",
    "",
    "> First-party financial oracle delivering real-time market data to blockchain applications.",
    "",
    "This file contains the complete Pyth documentation for LLM consumption.",
    "For a concise overview, see: https://docs.pyth.network/llms.txt",
    "",
    "---",
    "",
    ...processedPages.map((p) => p.text),
  ].join("\n");
  const fullDumpTokens = countTokens(fullDumpContent);

  // --- New approach: product-specific files ---
  const productResults: Record<
    string,
    {
      label: string;
      headerTokens: number;
      dynamicTokens: number;
      totalTokens: number;
      pageCount: number;
    }
  > = {};

  for (const [endpoint, config] of Object.entries(PRODUCT_ENDPOINTS)) {
    const header = STATIC_HEADER_SIZES[endpoint] ?? "";
    const headerTokens = countTokens(header);

    const matchingPages = processedPages.filter((p) =>
      config.paths.some((prefix) => p.page.urlPath.startsWith(prefix)),
    );
    const dynamicContent = matchingPages.map((p) => p.text).join("\n");
    const dynamicTokens = countTokens(dynamicContent);

    productResults[endpoint] = {
      label: config.label,
      headerTokens,
      dynamicTokens,
      totalTokens: headerTokens + dynamicTokens,
      pageCount: matchingPages.length,
    };
  }

  // --- Print results ---
  console.log("=".repeat(75));
  console.log("  OLD APPROACH (monolithic)");
  console.log("=".repeat(75));
  console.log(
    `  llms-full.txt (all ${String(allPages.length)} pages):  ${formatNumber(fullDumpTokens)} tokens`,
  );
  console.log();

  console.log("=".repeat(75));
  console.log("  NEW APPROACH (hub + product-specific files)");
  console.log("=".repeat(75));
  console.log(`  llms.txt (hub/index):  ${formatNumber(hubTokens)} tokens`);
  console.log();

  for (const [endpoint, result] of Object.entries(productResults)) {
    console.log(
      `  ${endpoint.padEnd(32)} ${formatNumber(result.totalTokens).padStart(8)} tokens  (${String(result.pageCount)} pages, header: ${formatNumber(result.headerTokens)}, content: ${formatNumber(result.dynamicTokens)})`,
    );
  }
  console.log();

  // --- Comparison ---
  console.log("=".repeat(75));
  console.log("  COMPARISON: old full dump vs new hub + product file");
  console.log("=".repeat(75));

  const sortedProducts = Object.values(productResults).sort(
    (a, b) => a.totalTokens - b.totalTokens,
  );
  const smallest = sortedProducts.at(0);
  const largest = sortedProducts.at(-1);

  if (!smallest || !largest) {
    console.log("  No product results to compare.");
    return;
  }

  const bestCase = hubTokens + smallest.totalTokens;
  const worstCase = hubTokens + largest.totalTokens;

  console.log(
    `  Old approach (always):            ${formatNumber(fullDumpTokens)} tokens`,
  );
  console.log();
  console.log(`  New best case (${smallest.label}):`);
  console.log(
    `    hub + product file:             ${formatNumber(bestCase)} tokens  (${formatPercent(1 - bestCase / fullDumpTokens)} savings)`,
  );
  console.log();
  console.log(`  New worst case (${largest.label}):`);
  console.log(
    `    hub + product file:             ${formatNumber(worstCase)} tokens  (${formatPercent(1 - worstCase / fullDumpTokens)} savings)`,
  );
  console.log();

  const avgProductTokens =
    Object.values(productResults).reduce((sum, r) => sum + r.totalTokens, 0) /
    Object.keys(productResults).length;
  const avgCase = hubTokens + avgProductTokens;
  console.log(`  New average case:`);
  console.log(
    `    hub + avg product file:         ${formatNumber(Math.round(avgCase))} tokens  (${formatPercent(1 - avgCase / fullDumpTokens)} savings)`,
  );

  console.log();
  console.log("=".repeat(75));
}

await main();
