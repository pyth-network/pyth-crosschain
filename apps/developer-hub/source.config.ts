import { rehypeCode } from "fumadocs-core/mdx-plugins";
import {
  defineCollections,
  defineConfig,
  defineDocs,
} from "fumadocs-mdx/config";
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
          name: "src",
          type: "mdxJsxAttribute",
          value: `https://mermaid.ink/svg/${encoded}`,
        },
        {
          name: "alt",
          type: "mdxJsxAttribute",
          value: "Mermaid diagram",
        },
      ];
      node.children = [];
      delete node.value;
      delete node.lang;
      delete node.meta;
      return;
    }
    const children = (node as { children?: Record<string, unknown>[] })
      .children;
    if (Array.isArray(children)) children.forEach(walk);
  };
  walk(tree as Record<string, unknown>);
};

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

// Cross-product changelog entries, one MDX file per entry under
// `content/changelog/`. The schema *is* the authoring ruleset — invalid
// frontmatter fails the build. `product` and `type` are required (exactly
// one each); `area` is optional. The filename doubles as the entry's stable
// anchor slug on the /changelog page.
export const changelog = defineCollections({
  dir: "content/changelog",
  schema: z.object({
    area: z
      .enum([
        "apis",
        "terminal",
        "market-data",
        "network",
        "contracts",
        "randomness",
      ])
      .optional(),
    // YAML turns an unquoted `date: 2026-07-10` into a Date object, so accept
    // both and normalize to YYYY-MM-DD.
    date: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()])
      .transform((d) =>
        typeof d === "string" ? d : d.toISOString().slice(0, 10),
      ),
    product: z.enum(["pyth-pro", "pyth-core", "entropy"]),
    title: z.string(),
    type: z.enum(["feature", "fix", "breaking-change", "deprecation", "docs"]),
  }),
  type: "doc",
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
    rehypePlugins: (v) => [rehypeKatex, rehypeCode, ...v],
    remarkPlugins: [remarkMath, remarkMermaidImg],
  },
});
