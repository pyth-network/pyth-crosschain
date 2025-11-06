import { promises as fs } from "node:fs";
import path from "node:path";

import { generateFiles } from "fumadocs-openapi";

import { openapi, products } from "../src/lib/openapi";


const outDir = "./content/docs/api-reference/(generated)/";

export async function generateDocs() {
  // await rimraf(outDir);
  
  await generateFiles({
    input: openapi,
    output: outDir,
    per: "operation",
    name: (output, document) => {
      // Extract product name from the OpenAPI document info
      const productName = getProductName(document.info.title);

      if (output.type === "operation") {
        const operation =
          document.paths?.[output.item.path]?.[output.item.method];
        const operationId =
          operation?.operationId ??
          output.item.path.replaceAll(/[^a-zA-Z0-9]/g, "_");
        return `${productName}/${operationId}`;
      }

      return `${productName}/webhooks/${output.item.name}`;
    },
    // index: {
    //   url: {
    //     baseUrl: "/api-reference/",
    //     contentDir: "./content/docs/api-reference",
    //   },
    //   items: Object.keys(products).map((productName) => ({
    //     path: `${productName}/index.mdx`,
    //   })),
    // },
  });

  // Generate meta.json after files are generated
  await generateMetaJson();
}

function getProductName(title: string) {
  // Match the title to a product name
  const titleLower = title.toLowerCase();
  for (const [name] of Object.entries(products)) {
    if (titleLower.includes(name)) {
      return name;
    }
  }
  return "unknown";
}

async function generateMetaJson() {
  const generatedPath = outDir;
  const metaJsonPath = "./content/docs/api-reference/meta.json";

  try {
    // Check if generated directory exists
    const generatedExists = await fs
      .access(generatedPath)
      .then(() => true)
      .catch(() => false);

    if (!generatedExists) {
      // eslint-disable-next-line no-console
      console.warn(
        `Generated directory does not exist: ${generatedPath}. Skipping meta.json generation.`,
      );
      return;
    }

    // Read all product folders from (generated) directory
    const entries = await fs.readdir(generatedPath, { withFileTypes: true });
    const productFolders = entries.filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith("."),
    );

    const pages: string[] = [];

    // Process each product folder
    for (const folder of productFolders) {
      const productKey = folder.name;
      const productFolderPath = path.join(generatedPath, productKey);

      // Get display name from products config, or use capitalized product key
      const productConfig =
        productKey in products
          ? products[productKey as keyof typeof products]
          : undefined;
      const displayName = productConfig
        ? productConfig.name
        : productKey.charAt(0).toUpperCase() + productKey.slice(1);

      // Read all .mdx files in the product folder
      const files = await fs.readdir(productFolderPath);
      const mdxFiles = files
        .filter((file) => file.endsWith(".mdx") && file !== "index.mdx")
        .map((file) => file.replace(".mdx", ""))
        .sort(); // Sort alphabetically

      if (mdxFiles.length === 0) {
        continue; // Skip empty folders
      }

      // Add separator and all pages under this folder (folder is implied by pages)
      pages.push(
        `---${displayName}---`,
        ...mdxFiles.map((pageName) => `(generated)/${productKey}/${pageName}`),
      );
    }

    // Create meta.json structure
    const metaJson = {
      title: "API Reference",
      root: true,
      pages,
    };

    // Ensure the api-reference directory exists
    const apiReferenceDir = path.dirname(metaJsonPath);
    await fs.mkdir(apiReferenceDir, { recursive: true });

    // Write meta.json file
    await fs.writeFile(
      metaJsonPath,
      JSON.stringify(metaJson, undefined, 2),
      "utf8",
    );

    // eslint-disable-next-line no-console
    console.log(`✅ Generated meta.json at ${metaJsonPath}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to generate meta.json:", error);
    throw error;
  }
}

await generateDocs();
