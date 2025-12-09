/**
 * API Reference Documentation Generator
 *
 * This script automatically generates API reference documentation from OpenAPI specifications.
 * It converts OpenAPI specs (from services like Hermes and Fortuna) into MDX documentation
 * files that are used by the Fumadocs documentation system.
 *
 * ## Workflow Overview
 *
 * 1. **File Generation**: Uses fumadocs-openapi to convert OpenAPI specs into MDX files
 *    - Each API endpoint becomes a separate MDX file
 *    - Files are organized by product (e.g., pyth-core, entropy) and service (e.g., hermes, fortuna)
 *
 * 2. **Meta File Generation**: Creates meta.json files for navigation
 *    - Root meta.json for the API reference section
 *    - Product-level meta.json files (e.g., pyth-core/meta.json)
 *    - Service-level meta.json files (e.g., pyth-core/hermes/meta.json)
 *
 * 3. **Post-Processing**: Customizes generated files to match our documentation structure
 *    - Updates MDX frontmatter titles to use endpoint paths instead of operation IDs
 *    - Rewrites index.mdx files to use APICard components with proper formatting
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

// ============================================================================
// Configuration
// ============================================================================

/**
 * Output directory for generated API reference documentation.
 * All MDX files and meta.json files are written to this directory.
 */
const OUTPUT_DIR = "./content/docs/api-reference/";

/**
 * Tracks generated endpoint operation IDs for each service.
 * Used to build navigation meta.json files and index pages.
 *
 * Structure: `\{ [serviceName]: [operationId1, operationId2, ...] \}`
 */
const generatedEndpoints: Record<string, string[]> = {};

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents an API card displayed on an index page.
 */
type ApiCardData = {
  /** URL path to the endpoint documentation page */
  href: string;
  /** API endpoint route (e.g., "/api/v1/price") */
  route: string;
  /** HTTP method (e.g., "GET", "POST") */
  method: string;
  /** First sentence of the endpoint description */
  description: string;
};

/**
 * Structure of a meta.json file for navigation.
 */
type MetaFile = {
  /** Whether this is the root navigation node */
  root?: boolean;
  /** Display title for the navigation item */
  title: string;
  /** Icon name (only for root meta files) */
  icon?: string;
  /** List of page identifiers (file names without .mdx extension) */
  pages: string[];
};

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * Main entry point for generating API reference documentation.
 *
 * This function orchestrates the entire documentation generation process:
 * 1. Generates MDX files from OpenAPI specs for each service
 * 2. Creates meta.json navigation files
 * 3. Post-processes MDX files to customize titles
 * 4. Updates index pages with API card components
 *
 * @throws Error If file generation or processing fails
 */
export async function generateDocs(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("Starting API reference documentation generation...\n");

  // Step 1: Generate MDX files from OpenAPI specifications
  await generateMdxFilesFromOpenApi();

  // Step 2: Generate meta.json files for navigation structure
  await generateMetaFiles();

  // Step 3: Post-process MDX files to use endpoint paths as titles
  await updateMdxTitles();

  // Step 4: Rewrite index pages to use APICard components
  await updateIndexCards();

  // eslint-disable-next-line no-console
  console.log("\n✅ Documentation generation complete!");
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

    // Initialize tracking for this service
    generatedEndpoints[serviceName] = [];

    // Create a separate OpenAPI instance for this service
    // This ensures each service's endpoints are isolated
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

        // Handle webhooks (if any)
        return `${config.product}/${serviceName}/webhooks/${output.item.name}`;
      },
      frontmatter: (context) => {
        // Set initial frontmatter title to endpoint path
        // This will be updated later in post-processing
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

/**
 * Generates a file name for an API operation and tracks it for meta file generation.
 *
 * @param output - Output object from fumadocs-openapi containing operation details
 * @param document - OpenAPI document containing full spec
 * @param serviceName - Name of the service (e.g., "hermes")
 * @param productName - Name of the product category (e.g., "pyth-core")
 * @returns File path relative to OUTPUT_DIR (e.g., "pyth-core/hermes/get_price_feed")
 */
function generateOperationFileName(
  output: { item: { path: string; method: string } },
  document: unknown,
  serviceName: string,
  productName: string,
): string {
  // Extract operation details from OpenAPI spec
  // Type assertion needed because fumadocs-openapi uses complex types
  const doc = document as {
    paths?: Record<
      string,
      Record<string, { operationId?: string } | undefined> | undefined
    >;
  };
  const operation = doc.paths?.[output.item.path]?.[output.item.method];

  // Use operationId if available, otherwise generate one from the path
  // Replace non-alphanumeric characters with underscores
  const operationId =
    operation?.operationId ??
    output.item.path.replaceAll(/[^a-zA-Z0-9]/g, "_");

  // Track this endpoint for meta file generation
  generatedEndpoints[serviceName]?.push(operationId);

  // eslint-disable-next-line no-console
  console.log(`    ✓ ${operationId}`);

  // Return file path: product/service/operationId
  return `${productName}/${serviceName}/${operationId}`;
}

// ============================================================================
// Meta File Generation
// ============================================================================

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

  // Group services by their product category
  const productGroups = groupServicesByProduct();

  // Generate root-level meta.json
  await generateRootMetaFile(productGroups);

  // Generate product and service-level meta.json files
  await generateProductAndServiceMetaFiles(productGroups);
}

/**
 * Groups services by their product category.
 *
 * @returns Object mapping product names to arrays of service names
 * @example `{ "pyth-core": ["hermes"], "entropy": ["fortuna"] }`
 */
function groupServicesByProduct(): Record<string, string[]> {
  const productGroups: Record<string, string[]> = {};

  for (const [serviceName, config] of Object.entries(products)) {
    productGroups[config.product] ??= [];
    productGroups[config.product]?.push(serviceName);
  }

  return productGroups;
}

/**
 * Generates the root meta.json file for the API reference section.
 *
 * This file defines the top-level navigation structure and lists all product categories.
 *
 * @param productGroups - Services grouped by product category
 */
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

/**
 * Generates meta.json files for each product and service.
 *
 * Creates:
 * - Product-level meta.json (e.g., pyth-core/meta.json) listing services
 * - Service-level meta.json (e.g., pyth-core/hermes/meta.json) listing endpoints
 *
 * @param productGroups - Services grouped by product category
 */
async function generateProductAndServiceMetaFiles(
  productGroups: Record<string, string[]>,
): Promise<void> {
  for (const [productName, services] of Object.entries(productGroups)) {
    // Generate product-level meta.json
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

/**
 * Formats a product name for display in navigation.
 *
 * Converts kebab-case to Title Case.
 *
 * @param productName - Product name in kebab-case (e.g., "pyth-core")
 * @returns Formatted title (e.g., "Pyth Core")
 * @example `formatProductTitle("pyth-core")` returns `"Pyth Core"`
 * @example `formatProductTitle("entropy")` returns `"Entropy"`
 */
function formatProductTitle(productName: string): string {
  return productName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Formats a service name for display in navigation.
 *
 * Capitalizes the first letter.
 *
 * @param serviceName - Service name (e.g., "hermes")
 * @returns Formatted title (e.g., "Hermes")
 * @example `formatServiceTitle("hermes")` returns `"Hermes"`
 * @example `formatServiceTitle("fortuna")` returns `"Fortuna"`
 */
function formatServiceTitle(serviceName: string): string {
  return serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
}

// ============================================================================
// Post-Processing
// ============================================================================

/**
 * Updates MDX file titles to use endpoint paths instead of operation IDs.
 *
 * Fumadocs generates files with titles based on operation IDs, but we want
 * to display the actual API endpoint path (e.g., "/api/v1/price") in the
 * navigation and page headers.
 *
 * This function:
 * - Reads each generated MDX file
 * - Extracts the route from the frontmatter
 * - Updates the title frontmatter field to use the route
 */
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

        await updateSingleMdxTitle(serviceDir, file, config.product, serviceName);
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

  // Extract the route from _openapi.route in frontmatter
  // Pattern matches: route: /api/v1/price
  const routeRegex = /route:\s*([^\n]+)/;
  const routeMatch = routeRegex.exec(content);

  if (!routeMatch?.[1]) {
    // No route found, skip this file
    return;
  }

  const route = routeMatch[1].trim();

  // Replace the title in frontmatter with the route
  // Pattern matches: ---\ntitle: Some Title
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
 *
 * Fumadocs generates basic index files, but we want to display endpoints
 * using our custom APICard components in a grid layout. This function:
 *
 * 1. Reads all endpoint MDX files for a service
 * 2. Extracts route, HTTP method, and description from each
 * 3. Generates a new index.mdx with APICard components
 *
 * Each card displays:
 * - Route as the title
 * - HTTP method as a badge
 * - First sentence of description as subtitle
 */
async function updateIndexCards(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    "\nUpdating index pages with APICard components...",
  );

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
    console.log(
      `  ✓ ${config.product}/${serviceName}/index.mdx`,
    );
  }
}

/**
 * Extracts API card data from all endpoint MDX files for a service.
 *
 * Reads each endpoint MDX file and extracts:
 * - Route (from frontmatter)
 * - HTTP method (from frontmatter)
 * - Description (from frontmatter, first sentence only)
 *
 * @param serviceDir - Directory containing endpoint MDX files
 * @param serviceName - Name of the service
 * @param productName - Name of the product category
 * @returns Array of API card data objects
 */
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

/**
 * Extracts API card data from a single MDX file's frontmatter.
 *
 * @param content - MDX file content
 * @param operationId - Operation ID (used as fallback for route)
 * @param productName - Product name for building href
 * @param serviceName - Service name for building href
 * @returns API card data object, or null if extraction fails
 */
function extractCardDataFromMdx(
  content: string,
  operationId: string,
  productName: string,
  serviceName: string,
): ApiCardData | null {
  // Extract route from frontmatter
  // Pattern: route: /api/v1/price
  const routeMatch = /route:\s*([^\n]+)/.exec(content);
  const route = routeMatch?.[1]?.trim() ?? operationId;

  // Extract HTTP method from frontmatter
  // Pattern: method: get
  const methodMatch = /method:\s*([^\n]+)/.exec(content);
  const method = methodMatch?.[1]?.trim().toUpperCase() ?? "GET";

  // Extract description from frontmatter
  // Handles both single-line and multiline YAML formats
  const description = extractDescriptionFromFrontmatter(content);

  return {
    href: `/api-reference/${productName}/${serviceName}/${operationId}`,
    route,
    method,
    description,
  };
}

/**
 * Extracts description text from MDX frontmatter.
 *
 * Handles two YAML formats:
 * 1. Single-line: `description: Some text here`
 * 2. Multiline: `description: >-\n  Line 1\n  Line 2`
 *
 * @param content - MDX file content
 * @returns First sentence of the description, cleaned of markdown formatting
 */
function extractDescriptionFromFrontmatter(content: string): string {
  let descText = "";

  // Try multiline format first: description: >-\n  text
  // Pattern matches YAML folded block scalar
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

/**
 * Generates the content for an index.mdx file with APICard components.
 *
 * @param cardData - Array of API card data to display
 * @returns Complete MDX file content as a string
 */
function generateIndexContent(cardData: ApiCardData[]): string {
  // Generate APICard components for each endpoint
  const cards = cardData
    .map(
      (card) =>
        `  <APICard href="${card.href}" title="${escapeQuotes(card.route)}" method="${card.method}" description="${escapeQuotes(card.description)}" />`,
    )
    .join("\n");

  return `---
title: Overview
---

{/* This file was generated by Fumadocs. Do not edit this file directly. Any changes should be made by running the generation command again. */}

<APICards>
${cards}
</APICards>
`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extracts the first sentence from a text string.
 *
 * Handles special cases:
 * - Removes markdown formatting (bold, italic)
 * - Skips "Deprecated" warnings to get the actual description
 * - Stops at sentence-ending punctuation (. ! ?)
 *
 * @param text - Text to extract sentence from
 * @returns First sentence, trimmed and cleaned
 * @example `getFirstSentence("Hello world. More text.")` returns `"Hello world."`
 * @example `getFirstSentence("**Deprecated**: Use new API.")` returns `"Use new API."`
 */
function getFirstSentence(text: string): string {
  if (!text) return "";

  // Remove markdown formatting (bold, italic, etc.)
  // Pattern matches: **text** or *text*
  let cleaned = text.replaceAll(/\*\*[^*]+\*\*/g, "").trim();

  // If text starts with "Deprecated..." skip to the actual description
  // Pattern: "Deprecated (reason): actual description"
  if (cleaned.toLowerCase().startsWith("deprecated")) {
    const afterDeprecated = cleaned.indexOf(")");
    if (afterDeprecated > 0) {
      cleaned = cleaned.slice(afterDeprecated + 1).trim();
    }
  }

  // Find sentence-ending punctuation
  // Pattern: . ! or ? followed by whitespace or end of string
  const sentenceEnd = cleaned.search(/[.!?](\s|$)/);
  if (sentenceEnd === -1) {
    // No sentence ending found, return entire cleaned text
    return cleaned.trim();
  }

  return cleaned.slice(0, sentenceEnd + 1).trim();
}

/**
 * Escapes double quotes in a string for use in JSX attributes.
 *
 * @param text - Text to escape
 * @returns Text with double quotes escaped as \"
 * @example `escapeQuotes('Say "hello"')` returns `'Say \\"hello\\"'`
 */
function escapeQuotes(text: string): string {
  return text.replaceAll('"', String.raw`\"`);
}

/**
 * Writes a JSON object to a file with proper formatting.
 *
 * @param filePath - Path to the file to write
 * @param data - Object to serialize as JSON
 * @throws Error If file write fails
 */
async function writeJson(filePath: string, data: object): Promise<void> {
  const jsonContent = JSON.stringify(data, undefined, 2) + "\n";
  await fs.writeFile(filePath, jsonContent);
}

// ============================================================================
// Script Execution
// ============================================================================

// Execute the main generation function when script is run directly
await generateDocs();
