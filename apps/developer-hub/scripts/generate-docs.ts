import * as fs from "node:fs/promises";
import path from "node:path";

import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

import { products } from "../src/lib/openapi";

const outDir = "./content/docs/api-reference/";

// Track generated files for each service to build meta.json
const generatedEndpoints: Record<string, string[]> = {};

export async function generateDocs() {
  // Generate docs separately for each service to ensure index files only contain
  // endpoints from that specific service
  for (const [serviceName, config] of Object.entries(products)) {
    // eslint-disable-next-line no-console
    console.log(`\nGenerating docs for ${serviceName}...`);

    generatedEndpoints[serviceName] = [];

    // Create a separate OpenAPI instance for this service
    const serviceOpenapi = createOpenAPI({
      input: [config.openApiUrl],
    });

    await generateFiles({
      input: serviceOpenapi,
      output: outDir,
      per: "operation",
      name: (output, document) => {
        if (output.type === "operation") {
          const operation =
            document.paths?.[output.item.path]?.[output.item.method];
          const operationId =
            operation?.operationId ??
            output.item.path.replaceAll(/[^a-zA-Z0-9]/g, "_");

          // Track generated endpoints
          generatedEndpoints[serviceName]?.push(operationId);

          // eslint-disable-next-line no-console
          console.log(`  - ${operationId}`);
          return `${config.product}/${serviceName}/${operationId}`;
        }

        return `${config.product}/${serviceName}/webhooks/${output.item.name}`;
      },
      frontmatter: (context) => {
        // Use endpoint path as title for navigation
        const ctx = context as { type?: string; path?: string };
        if (ctx.type === "operation" && ctx.path) {
          return {
            title: ctx.path,
          };
        }
        return {};
      },
      index: {
        url: {
          baseUrl: "/api-reference/",
          contentDir: "./content/docs/api-reference",
        },
        items: [
          {
            path: `${config.product}/${serviceName}/index.mdx`,
          },
        ],
      },
    });
  }

  // Generate all meta.json files
  await generateMetaFiles();

  // Post-process MDX files to use endpoint paths as titles
  await updateMdxTitles();

  // Rewrite index cards to use path as title and first sentence as description
  await updateIndexCards();
}

async function generateMetaFiles() {
  // eslint-disable-next-line no-console
  console.log("\nGenerating meta.json files...");

  // Group products by their parent product category
  const productGroups: Record<string, string[]> = {};
  for (const [serviceName, config] of Object.entries(products)) {
    productGroups[config.product] ??= [];
    productGroups[config.product]?.push(serviceName);
  }

  // 1. Generate root api-reference/meta.json
  const rootMeta = {
    root: true,
    title: "API Reference",
    icon: "Code",
    pages: Object.keys(productGroups),
  };
  await writeJson(path.join(outDir, "meta.json"), rootMeta);
  // eslint-disable-next-line no-console
  console.log("  - api-reference/meta.json");

  // 2. Generate product meta.json files (e.g., pyth-core, entropy)
  for (const [productName, services] of Object.entries(productGroups)) {
    const productMeta = {
      title: formatProductTitle(productName),
      pages: services,
    };
    const productDir = path.join(outDir, productName);
    await fs.mkdir(productDir, { recursive: true });
    await writeJson(path.join(productDir, "meta.json"), productMeta);
    // eslint-disable-next-line no-console
    console.log(`  - ${productName}/meta.json`);

    // 3. Generate service meta.json files (e.g., hermes, fortuna)
    for (const serviceName of services) {
      const endpoints = generatedEndpoints[serviceName] ?? [];
      const serviceMeta = {
        title: formatServiceTitle(serviceName),
        pages: ["index", ...endpoints],
      };
      const serviceDir = path.join(productDir, serviceName);
      await writeJson(path.join(serviceDir, "meta.json"), serviceMeta);
      // eslint-disable-next-line no-console
      console.log(`  - ${productName}/${serviceName}/meta.json`);
    }
  }
}

function formatProductTitle(productName: string): string {
  // Convert "pyth-core" to "Pyth Core", "entropy" to "Entropy"
  return productName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatServiceTitle(serviceName: string): string {
  // Capitalize first letter: "hermes" -> "Hermes"
  return serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
}

async function writeJson(filePath: string, data: object): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, undefined, 2) + "\n");
}

async function updateMdxTitles(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("\nUpdating MDX titles to use endpoint paths...");

  // Process all service directories
  for (const [serviceName, config] of Object.entries(products)) {
    const serviceDir = path.join(outDir, config.product, serviceName);

    try {
      const files = await fs.readdir(serviceDir);

      for (const file of files) {
        if (!file.endsWith(".mdx") || file === "index.mdx") continue;

        const filePath = path.join(serviceDir, file);
        const content = await fs.readFile(filePath, "utf8");

        // Extract the route from _openapi.route in frontmatter
        const routeRegex = /route:\s*([^\n]+)/;
        const routeMatch = routeRegex.exec(content);
        if (!routeMatch?.[1]) continue;

        const route = routeMatch[1].trim();

        // Replace the title in frontmatter with the route
        const updatedContent = content.replace(
          /^---\ntitle:\s*[^\n]+/,
          `---\ntitle: "${route}"`,
        );

        if (updatedContent !== content) {
          await fs.writeFile(filePath, updatedContent);
          // eslint-disable-next-line no-console
          console.log(`  - Updated: ${config.product}/${serviceName}/${file}`);
        }
      }
    } catch {
      // Directory might not exist yet
    }
  }
}

async function updateIndexCards(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    "\nUpdating index cards to use path titles + first-sentence descriptions...",
  );

  for (const [serviceName, config] of Object.entries(products)) {
    const serviceDir = path.join(outDir, config.product, serviceName);
    const indexPath = path.join(serviceDir, "index.mdx");

    try {
      await fs.access(indexPath);
    } catch {
      continue;
    }

    // Read all endpoint MDX files to extract route, method, and description
    const endpoints = generatedEndpoints[serviceName] ?? [];
    const cardData: {
      href: string;
      route: string;
      method: string;
      description: string;
    }[] = [];

    for (const operationId of endpoints) {
      const mdxPath = path.join(serviceDir, `${operationId}.mdx`);
      try {
        const content = await fs.readFile(mdxPath, "utf8");

        // Extract route
        const routeMatch = /route:\s*([^\n]+)/.exec(content);
        const route = routeMatch?.[1]?.trim() ?? operationId;

        // Extract method
        const methodMatch = /method:\s*([^\n]+)/.exec(content);
        const method = methodMatch?.[1]?.trim().toUpperCase() ?? "GET";

        // Extract description (handle both single-line and multiline formats)
        let descText = "";

        // Try multiline format first: description: >-\n  text
        const multilineMatch = /description:\s*>-\s*\n((?:\s{2}.*\n)+)/.exec(
          content,
        );
        if (multilineMatch?.[1]) {
          descText = multilineMatch[1]
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .join(" ");
        } else {
          // Try single-line format: description: text
          const singleMatch = /description:\s*([^\n]+)/.exec(content);
          if (singleMatch?.[1]) {
            descText = singleMatch[1].trim();
          }
        }

        const firstSentence = getFirstSentence(descText);

        cardData.push({
          href: `/api-reference/${config.product}/${serviceName}/${operationId}`,
          route,
          method,
          description: firstSentence,
        });
      } catch {
        // Skip if file doesn't exist
      }
    }

    // Build new index content with APICards grid and APICard components
    const cards = cardData
      .map(
        (card) =>
          `  <APICard href="${card.href}" title="${escapeQuotes(card.route)}" method="${card.method}" description="${escapeQuotes(card.description)}" />`,
      )
      .join("\n");

    const newIndex = `---
title: Overview
---

{/* This file was generated by Fumadocs. Do not edit this file directly. Any changes should be made by running the generation command again. */}

<APICards>
${cards}
</APICards>
`;

    await fs.writeFile(indexPath, newIndex);
    // eslint-disable-next-line no-console
    console.log(
      `  - Updated index: ${config.product}/${serviceName}/index.mdx`,
    );
  }
}

function getFirstSentence(text: string): string {
  if (!text) return "";

  // Remove markdown formatting (bold, italic, etc.)
  let cleaned = text.replaceAll(/\*\*[^*]+\*\*/g, "").trim();

  // If text starts with "Deprecated..." or similar, skip to the actual description
  if (cleaned.toLowerCase().startsWith("deprecated")) {
    const afterDeprecated = cleaned.indexOf(")");
    if (afterDeprecated > 0) {
      cleaned = cleaned.slice(afterDeprecated + 1).trim();
    }
  }

  const sentenceEnd = cleaned.search(/[.!?](\s|$)/);
  if (sentenceEnd === -1) return cleaned.trim();
  return cleaned.slice(0, sentenceEnd + 1).trim();
}

function escapeQuotes(text: string): string {
  return text.replaceAll('"', String.raw`\"`);
}

await generateDocs();
