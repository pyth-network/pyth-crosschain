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

  const cwd = process.cwd();
  const abs = page.absolutePath;
  const pathArray: string[] = Array.isArray(page.path)
    ? page.path
    : [page.path];
  const repoRel = path.join(
    cwd,
    "apps",
    "developer-hub",
    "content",
    "docs",
    ...pathArray,
  );
  const appRel = path.join(cwd, "content", "docs", ...pathArray);

  // eslint-disable-next-line no-console
  console.error("🧪[LLM] url=", page.url);
  // eslint-disable-next-line no-console
  console.error("🧪[LLM] cwd=", cwd);
  // eslint-disable-next-line no-console
  console.error("🧪[LLM] abs=", abs, "exists=", abs ? existsSync(abs) : false);
  // eslint-disable-next-line no-console
  console.error("🧪[LLM] repoRel=", repoRel, "exists=", existsSync(repoRel));
  // eslint-disable-next-line no-console
  console.error("🧪[LLM] appRel=", appRel, "exists=", existsSync(appRel));

  // eslint-disable-next-line no-console
  console.error(`Getting LLM text for ${page.absolutePath}`);
  const processed = await processor.process({
    path: page.absolutePath,
    value: await readFile(page.absolutePath, "utf8"),
  });

  return `# ${page.data.title ?? "Untitled"}
URL: ${page.url}

${String(processed.value)}`;
}
