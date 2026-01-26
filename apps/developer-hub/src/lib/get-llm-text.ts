import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "fumadocs-core/source";
import { remarkInclude } from "fumadocs-mdx/config";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";

import { source } from "./source";

const processor = remark()
  .use(remarkMath)
  .use(remarkMdx)
  .use(remarkInclude)
  .use(remarkGfm);

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

export async function getLLMTextByPaths(
  pathPrefixes: string[]
): Promise<string[]> {
  const pages = source.getPages();
  const filtered = pages.filter((page) =>
    pathPrefixes.some((prefix) => page.url.startsWith(prefix))
  );
  return Promise.all(filtered.map((page) => getLLMText(page)));
}
