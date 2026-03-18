import { rehypeCode, remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { z } from "zod";
export const docs = defineDocs({
  docs: {
    schema: z.object({
      description: z.string(),
      full: z.boolean().default(false),
      icon: z.string().optional(),
      index: z.boolean().default(false),
      title: z.string(),
    }),
  },
  meta: {
    schema: z.object({
      defaultOpen: z.boolean().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      pages: z.array(z.string()).optional(),
      root: z.boolean().optional(),
      title: z.string().optional(),
    }),
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      inline: "tailing-curly-colon",
      langs: [
        "solidity",
        "ts",
        "bash",
        "js",
        "json",
        "md",
        "mdx",
        "python",
        "rust",
        "sh",
        "yaml",
      ],
      themes: {
        dark: "github-dark",
        light: "github-light",
      },
    },
    rehypePlugins: (v) => [rehypeKatex, rehypeCode, remarkMdxMermaid, ...v],
    remarkPlugins: [remarkMath],
  },
});
