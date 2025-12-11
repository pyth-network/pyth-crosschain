/**
 * API Reference Documentation Generator
 *
 * This script automatically generates API reference documentation from OpenAPI specifications.
 * It converts OpenAPI specs (from services like Hermes and Fortuna) into MDX documentation
 * files that are used by the Fumadocs documentation system.
 *
 *
 * ## Usage
 *
 * This script runs automatically during the build process. To run it manually:
 *
 * ```bash
 * pnpm generate:docs
 * ```
 *
 * ## Configuration
 *
 * To add a new API service, add it to `src/lib/openapi.ts` in the `products` object.
 * Each service needs:
 * - `name`: Service identifier (e.g., "hermes")
 * - `product`: Product category (e.g., "pyth-core")
 * - `openApiUrl`: URL to the OpenAPI specification JSON
 *
 */

import * as fs from "node:fs/promises";
import path from "node:path";

import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

import { products } from "../src/lib/openapi";

const OUTPUT_DIR = "./content/docs/api-reference/";

const generatedEndpoints: Record<string, string[]> = {};

type ApiCardData = {
  href: string;
  route: string;
  method: string;
  description: string;
};

type MetaFile = {
  root?: boolean;
  title: string;
  icon?: string;
  pages: string[];
};

export async function generateDocs(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("Starting API reference documentation generation...\n");

  await generateMdxFilesFromOpenApi();

  await generateMetaFiles();

  await generateApiReferenceIndex();

  await updateMdxTitles();

  await updateIndexCards();

  // eslint-disable-next-line no-console
  console.log("\nDocumentation generation complete!");
}

// ============================================================================
// File Generation
// ============================================================================

/**
 * Generates MDX documentation files from OpenAPI specifications.
 *
 * Processes each service separately to ensure:
 * - Index files only contain endpoints from that specific service
 * - Each service can have its own OpenAPI spec URL
 * - Generated files are organized by product/service hierarchy
 *
 * For each service:
 * - Creates an OpenAPI instance from the service's spec URL
 * - Generates one MDX file per API operation
 * - Tracks generated operation IDs for later use in meta files
 * - Creates an index.mdx file listing all endpoints
 */
async function generateMdxFilesFromOpenApi(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("Generating MDX files from OpenAPI specifications...");

  for (const [serviceName, config] of Object.entries(products)) {
    // eslint-disable-next-line no-console
    console.log(`\n  Processing service: ${serviceName}`);

    generatedEndpoints[serviceName] = [];

    const serviceOpenapi = createOpenAPI({
      input: [config.openApiUrl],
    });

    // Generate MDX files using fumadocs-openapi
    await generateFiles({
      input: serviceOpenapi,
      output: OUTPUT_DIR,
      per: "operation", // One file per API operation
      name: (output, document) => {
        // Generate file name based on operation type
        if (output.type === "operation") {
          return generateOperationFileName(
            output,
            document,
            serviceName,
            config.product,
          );
        }

        return `${config.product}/${serviceName}/webhooks/${output.item.name}`;
      },
      frontmatter: (context) => {
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
}

function generateOperationFileName(
  output: { item: { path: string; method: string } },
  document: unknown,
  serviceName: string,
  productName: string,
): string {
  const doc = document as {
    paths?: Record<
      string,
      Record<string, { operationId?: string } | undefined> | undefined
    >;
  };
  const operation = doc.paths?.[output.item.path]?.[output.item.method];

  const operationId =
    operation?.operationId ?? output.item.path.replaceAll(/[^a-zA-Z0-9]/g, "_");

  // Track this endpoint for meta file generation
  generatedEndpoints[serviceName]?.push(operationId);

  // eslint-disable-next-line no-console
  console.log(`    ✓ ${operationId}`);

  // Return file path: product/service/operationId
  return `${productName}/${serviceName}/${operationId}`;
}

/**
 * Generates all meta.json files for navigation structure.
 *
 * Creates a three-level hierarchy:
 * 1. Root meta.json: Lists all product categories (e.g., pyth-core, entropy)
 * 2. Product meta.json: Lists all services in that product (e.g., hermes in pyth-core)
 * 3. Service meta.json: Lists all endpoints in that service (e.g., get_price_feed in hermes)
 *
 * These meta.json files are used by Fumadocs to build the navigation sidebar.
 */
async function generateMetaFiles(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("\nGenerating meta.json navigation files...");

  const productGroups = groupServicesByProduct();

  await generateRootMetaFile(productGroups);

  await generateProductAndServiceMetaFiles(productGroups);
}

function groupServicesByProduct(): Record<string, string[]> {
  const productGroups: Record<string, string[]> = {};

  for (const [serviceName, config] of Object.entries(products)) {
    productGroups[config.product] ??= [];
    productGroups[config.product]?.push(serviceName);
  }

  return productGroups;
}

async function generateRootMetaFile(
  productGroups: Record<string, string[]>,
): Promise<void> {
  const rootMeta: MetaFile = {
    root: true,
    title: "API Reference",
    icon: "Code",
    pages: Object.keys(productGroups),
  };

  await writeJson(path.join(OUTPUT_DIR, "meta.json"), rootMeta);
  // eslint-disable-next-line no-console
  console.log("  ✓ api-reference/meta.json");
}

async function generateProductAndServiceMetaFiles(
  productGroups: Record<string, string[]>,
): Promise<void> {
  for (const [productName, services] of Object.entries(productGroups)) {
    const productMeta: MetaFile = {
      title: formatProductTitle(productName),
      pages: services,
    };

    const productDir = path.join(OUTPUT_DIR, productName);
    await fs.mkdir(productDir, { recursive: true });
    await writeJson(path.join(productDir, "meta.json"), productMeta);
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${productName}/meta.json`);

    // Generate service-level meta.json files
    for (const serviceName of services) {
      const endpoints = generatedEndpoints[serviceName] ?? [];
      const serviceMeta: MetaFile = {
        title: formatServiceTitle(serviceName),
        pages: ["index", ...endpoints],
      };

      const serviceDir = path.join(productDir, serviceName);
      await writeJson(path.join(serviceDir, "meta.json"), serviceMeta);
      // eslint-disable-next-line no-console
      console.log(`  ✓ ${productName}/${serviceName}/meta.json`);
    }
  }
}

function formatProductTitle(productName: string): string {
  return productName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatServiceTitle(serviceName: string): string {
  return serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
}

/**
 * Generates the API Reference index page (content/docs/api-reference/index.mdx).
 *
 * Creates a page that lists all products and their associated services using
 * IntegrationCard components in a simple grid layout.
 */
async function generateApiReferenceIndex(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("\nGenerating API Reference index page...");

  const productGroups = groupServicesByProduct();

  // Map service names to their configurations and metadata
  const serviceMetadata: Record<
    string,
    {
      name: string;
      product: string;
      icon: string;
      colorScheme: "green" | "blue" | "purple" | "yellow";
      description: string;
    }
  > = {
    fortuna: {
      name: "fortuna",
      product: "entropy",
      icon: "DiceSix",
      colorScheme: "green",
      description: "Random number generation API with callback support",
    },
    hermes: {
      name: "hermes",
      product: "pyth-core",
      icon: "Database",
      colorScheme: "blue",
      description: "REST API for accessing price feeds and updates",
    },
  };

  // Generate product sections
  const productSections: string[] = [];

  for (const [productName, services] of Object.entries(productGroups)) {
    const productTitle = formatProductTitle(productName);
    const serviceCards: string[] = [];

    for (const serviceName of services) {
      const metadata = serviceMetadata[serviceName];
      if (!metadata) continue;

      const serviceTitle = formatServiceTitle(serviceName);
      const serviceHref = `/api-reference/${productName}/${serviceName}`;

      serviceCards.push(
        `  <IntegrationCard
    href="${serviceHref}"
    title="${serviceTitle}"
    description="${metadata.description}"
    icon={<${metadata.icon} size={16} />}
    colorScheme="${metadata.colorScheme}"
  />`,
      );
    }

    if (serviceCards.length > 0) {
      productSections.push(`## ${productTitle}

<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
${serviceCards.join("\n")}
</div>
`);
    }
  }

  // Generate the complete MDX content
  const indexContent = `---
title: API Reference
description: Complete API reference for Pyth Network services
---

import { IntegrationCard } from "../../../src/components/IntegrationCard";
import { DiceSix, Database } from "@phosphor-icons/react/dist/ssr";

Welcome to the Pyth Network API Reference. Explore REST APIs for our core services.

${productSections.join("\n")}
`;

  const indexPath = path.join(OUTPUT_DIR, "index.mdx");
  await fs.writeFile(indexPath, indexContent);
  // eslint-disable-next-line no-console
  console.log("  ✓ api-reference/index.mdx");
}

async function updateMdxTitles(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("\nUpdating MDX file titles to use endpoint paths...");

  for (const [serviceName, config] of Object.entries(products)) {
    const serviceDir = path.join(OUTPUT_DIR, config.product, serviceName);

    try {
      const files = await fs.readdir(serviceDir);

      for (const file of files) {
        // Skip non-MDX files and index files
        if (!file.endsWith(".mdx") || file === "index.mdx") continue;

        await updateSingleMdxTitle(
          serviceDir,
          file,
          config.product,
          serviceName,
        );
      }
    } catch {
      // Directory might not exist if no endpoints were generated
      // This is fine, just skip this service
    }
  }
}

/**
 * Updates the title in a single MDX file to use the endpoint route.
 *
 * @param serviceDir - Directory containing the MDX file
 * @param fileName - Name of the MDX file to update
 * @param productName - Product name for logging
 * @param serviceName - Service name for logging
 */
async function updateSingleMdxTitle(
  serviceDir: string,
  fileName: string,
  productName: string,
  serviceName: string,
): Promise<void> {
  const filePath = path.join(serviceDir, fileName);
  const content = await fs.readFile(filePath, "utf8");

  const routeRegex = /route:\s*([^\n]+)/;
  const routeMatch = routeRegex.exec(content);

  if (!routeMatch?.[1]) {
    // No route found, skip this file
    return;
  }

  const route = routeMatch[1].trim();

  const updatedContent = content.replace(
    /^---\ntitle:\s*[^\n]+/,
    `---\ntitle: "${route}"`,
  );

  // Only write if content actually changed
  if (updatedContent !== content) {
    await fs.writeFile(filePath, updatedContent);
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${productName}/${serviceName}/${fileName}`);
  }
}

/**
 * Updates index.mdx files to use APICard components.
 **/
async function updateIndexCards(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("\nUpdating index pages with APICard components...");

  for (const [serviceName, config] of Object.entries(products)) {
    const serviceDir = path.join(OUTPUT_DIR, config.product, serviceName);
    const indexPath = path.join(serviceDir, "index.mdx");

    // Skip if index file doesn't exist
    try {
      await fs.access(indexPath);
    } catch {
      continue;
    }

    // Extract card data from all endpoint files
    const cardData = await extractApiCardData(
      serviceDir,
      serviceName,
      config.product,
    );

    // Generate new index content with APICard components
    const newIndexContent = generateIndexContent(cardData);

    await fs.writeFile(indexPath, newIndexContent);
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${config.product}/${serviceName}/index.mdx`);
  }
}

async function extractApiCardData(
  serviceDir: string,
  serviceName: string,
  productName: string,
): Promise<ApiCardData[]> {
  const endpoints = generatedEndpoints[serviceName] ?? [];
  const cardData: ApiCardData[] = [];

  for (const operationId of endpoints) {
    const mdxPath = path.join(serviceDir, `${operationId}.mdx`);

    try {
      const content = await fs.readFile(mdxPath, "utf8");
      const card = extractCardDataFromMdx(
        content,
        operationId,
        productName,
        serviceName,
      );

      if (card) {
        cardData.push(card);
      }
    } catch {
      // File doesn't exist, skip it
      // This can happen if generation failed for this endpoint
    }
  }

  return cardData;
}

function extractCardDataFromMdx(
  content: string,
  operationId: string,
  productName: string,
  serviceName: string,
): ApiCardData | null {
  const routeMatch = /route:\s*([^\n]+)/.exec(content);
  const route = routeMatch?.[1]?.trim() ?? operationId;

  const methodMatch = /method:\s*([^\n]+)/.exec(content);
  const method = methodMatch?.[1]?.trim().toUpperCase() ?? "GET";

  const description = extractDescriptionFromFrontmatter(content);

  return {
    href: `/api-reference/${productName}/${serviceName}/${operationId}`,
    route,
    method,
    description,
  };
}

function extractDescriptionFromFrontmatter(content: string): string {
  let descText = "";

  const multilineMatch = /description:\s*>-\s*\n((?:\s{2}.*\n)+)/.exec(content);
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

  // Extract first sentence and clean formatting
  return getFirstSentence(descText);
}

function generateIndexContent(cardData: ApiCardData[]): string {
  const cards = cardData
    .map(
      (card) =>
        `  <APICard href="${card.href}" title="${escapeQuotes(card.route)}" method="${card.method}" description="${escapeQuotes(card.description)}" />`,
    )
    .join("\n");

  return `---
title: Overview
---

<APICards>
${cards}
</APICards>
`;
}

function getFirstSentence(text: string): string {
  if (!text) return "";

  let cleaned = text.replaceAll(/\*\*[^*]+\*\*/g, "").trim();

  if (cleaned.toLowerCase().startsWith("deprecated")) {
    const afterDeprecated = cleaned.indexOf(")");
    if (afterDeprecated > 0) {
      cleaned = cleaned.slice(afterDeprecated + 1).trim();
    }
  }

  const sentenceEnd = cleaned.search(/[.!?](\s|$)/);
  if (sentenceEnd === -1) {
    return cleaned.trim();
  }

  return cleaned.slice(0, sentenceEnd + 1).trim();
}

function escapeQuotes(text: string): string {
  return text.replaceAll('"', String.raw`\"`);
}

async function writeJson(filePath: string, data: object): Promise<void> {
  const jsonContent = JSON.stringify(data, undefined, 2) + "\n";
  await fs.writeFile(filePath, jsonContent);
}

await generateDocs();
