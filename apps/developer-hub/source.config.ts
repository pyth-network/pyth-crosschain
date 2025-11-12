import { remarkMdxMermaid, rehypeCode } from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { z } from "zod";
export const docs = defineDocs({
  docs: {
    schema: z.object({
      title: z.string(),
      description: z.string(),
      icon: z.string().optional(),
      full: z.boolean().default(false),
      index: z.boolean().default(false),
    }),
  },
  meta: {
    schema: z.object({
      title: z.string().optional(),
      pages: z.array(z.string()).optional(),
      description: z.string().optional(),
      root: z.boolean().optional(),
      defaultOpen: z.boolean().optional(),
      icon: z.string().optional(),
    }),
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
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
      inline: "tailing-curly-colon",
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    },
    remarkPlugins: [remarkMath],
    rehypePlugins: (v) => [rehypeKatex, rehypeCode, remarkMdxMermaid, ...v],
  },
});
