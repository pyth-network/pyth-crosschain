import { rehypeCode } from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { z } from "zod";

// Replace ```mermaid fenced blocks with a <MermaidDiagram> MDX element
// pointing at mermaid.ink, which renders the diagram source to SVG.
// MermaidDiagram is registered in src/mdx-components.tsx as a plain <img>
// — using lowercase <img> here would be intercepted by fumadocs-ui's
// next/image mapping, which requires width/height.
const remarkMermaidImg = () => (tree: { children?: unknown[] }) => {
  const walk = (node: Record<string, unknown>) => {
    if (node.type === "code" && node.lang === "mermaid") {
      const source = String(node.value ?? "");
      // base64url (RFC 4648 §5) keeps the encoded string URL-path-safe.
      // Standard base64 can emit `/` which would split the mermaid.ink
      // path and cause a 404; `+` is also unsafe in URL paths.
      const encoded = Buffer.from(source, "utf8").toString("base64url");
      node.type = "mdxJsxFlowElement";
      node.name = "MermaidDiagram";
      node.attributes = [
        {
          type: "mdxJsxAttribute",
          name: "src",
          value: `https://mermaid.ink/svg/${encoded}`,
        },
        {
          type: "mdxJsxAttribute",
          name: "alt",
          value: "Mermaid diagram",
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
