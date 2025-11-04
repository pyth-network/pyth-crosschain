import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "fumadocs-core/source";
import { remarkInclude } from "fumadocs-mdx/config";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";

const processor = remark().use(remarkMdx).use(remarkInclude).use(remarkGfm);

function resolveMdxPath(page: Page): string {
  const appRelPath = [process.cwd(), "content", "docs", page.path] as [
    string,
    ...string[],
  ];

  if (existsSync(path.join(...appRelPath))) {
    return path.join(...appRelPath);
  } else throw new Error(`MDX file not found at ${path.join(...appRelPath)}`);
}

export async function getLLMText(page: Page) {
  const mdxPath = resolveMdxPath(page);

  const processed = await processor.process({
    path: mdxPath,
    value: await readFile(mdxPath, "utf8"),
  });

  return `# ${page.data.title ?? "Untitled"}
URL: ${page.url}

${String(processed.value)}`;
}
