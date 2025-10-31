import fs from "node:fs/promises";

import type { Page } from "fumadocs-core/source";
import { remarkInclude } from "fumadocs-mdx/config";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";

const processor = remark().use(remarkMdx).use(remarkInclude).use(remarkGfm);

export async function getLLMText(page: Page) {
  const processed = await processor.process({
    path: page.path,
    value: await fs.readFile(page.absolutePath, "utf8"),
  });

  return `# ${page.data.title ?? "Untitled"}
URL: ${page.url}

${String(processed.value)}`;
}
