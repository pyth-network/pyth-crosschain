import { rehypeCode } from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { z } from "zod";

// Tiny remark plugin: replace ```mermaid fenced blocks with an <img>
// pointing at mermaid.ink, which renders the diagram source to SVG.
// Zero new npm deps; zero client-side JS for rendering.
const remarkMermaidImg = () => (tree: { children?: unknown[] }) => {
  const walk = (node: Record<string, unknown>) => {
    if (node.type === "code" && node.lang === "mermaid") {
      const source = String(node.value ?? "");
      const encoded = Buffer.from(source, "utf8").toString("base64");
      const src = `https://mermaid.ink/svg/${encoded}`;
      node.type = "mdxJsxFlowElement";
      node.name = "img";
      node.attributes = [
        { type: "mdxJsxAttribute", name: "src", value: src },
        { type: "mdxJsxAttribute", name: "alt", value: "Mermaid diagram" },
        {
          type: "mdxJsxAttribute",
          name: "style",
          value: "max-width: 100%; height: auto; display: block; margin: 1.5rem auto;",
        },
      ];
      node.children = [];
      delete node.value;
      delete node.lang;
      delete node.meta;
      return;
    }
    const children = (node as { children?: Record<string, unknown>[] }).children;
    if (Array.isArray(children)) children.forEach(walk);
  };
  walk(tree as Record<string, unknown>);
};

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
    remarkPlugins: [remarkMath, remarkMermaidImg],
    rehypePlugins: (v) => [rehypeKatex, rehypeCode, ...v],
  },
});
