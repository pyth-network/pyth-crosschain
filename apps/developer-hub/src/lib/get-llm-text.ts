import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "fumadocs-core/source";
import { remarkInclude } from "fumadocs-mdx/config";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";

const processor = remark().use(remarkMdx).use(remarkInclude).use(remarkGfm);

export async function getLLMText(page: Page) {
  // eslint-disable-next-line no-console
  console.error("🔥 getLLMText EXECUTED at", new Date().toISOString());

  // Resolve a readable MDX path in this Lambda:
  // 1) app-relative (when Vercel Root Directory is apps/developer-hub)
  // 2) repo-relative (monorepo root)
  // 3) absolutePath provided by Fumadocs (works locally)
  const pathArray: string[] = Array.isArray(page.path)
    ? page.path
    : [page.path];
  const appRelTry = path.join(process.cwd(), "content", "docs", ...pathArray);
  const repoRelTry = path.join(
    process.cwd(),
    "apps",
    "developer-hub",
    "content",
    "docs",
    ...pathArray,
  );
  const absTry = page.absolutePath;

  let mdxPath: string | undefined;
  if (existsSync(appRelTry)) {
    mdxPath = appRelTry;
  } else if (existsSync(repoRelTry)) {
    mdxPath = repoRelTry;
  } else if (absTry && existsSync(absTry)) {
    mdxPath = absTry;
  }

  // eslint-disable-next-line no-console
  console.error("🧪[LLM] chosenPath=", mdxPath);

  if (!mdxPath) {
    throw new Error(
      `MDX file not found at any known path:
       appRel=${appRelTry},
       repoRel=${repoRelTry},
       abs=${absTry}`,
    );
  }

  // eslint-disable-next-line no-console
  console.error(`Getting LLM text for ${mdxPath}`);
  const processed = await processor.process({
    path: mdxPath,
    value: await readFile(mdxPath, "utf8"),
  });

  return `# ${page.data.title ?? "Untitled"}
URL: ${page.url}

${String(processed.value)}`;
}
