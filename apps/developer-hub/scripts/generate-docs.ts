import { generateFiles } from "fumadocs-openapi";

import { openapi, products } from "../src/lib/openapi";

const outDir = "./content/docs/openapi/";

export async function generateDocs() {
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
    index: {
      url: {
        baseUrl: "/openapi/",
        contentDir: "./content/docs/openapi",
      },
      items: Object.keys(products).map((productName) => ({
        path: `${productName}/index.mdx`,
      })),
    },
  });
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

await generateDocs();
