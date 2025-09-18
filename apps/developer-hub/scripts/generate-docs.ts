import { generateFiles } from "fumadocs-openapi";

import { openapi } from "../src/lib/openapi";

const outDir = "./content/docs/openapi/operation/route";

export async function generateDocs() {
    await generateFiles({
        input: openapi,
        output: outDir,
        per: 'operation',
        includeDescription: true,
    });
}

await generateDocs();