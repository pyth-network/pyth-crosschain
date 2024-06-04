import type { MDXComponents } from "mdx/types";

import { InlineCode } from "./components/InlineCode";
import { InlineLink } from "./components/InlineLink";
import { Paragraph } from "./components/Paragraph";

export const useMDXComponents = (components: MDXComponents): MDXComponents => ({
  h1: ({ children, ...props }) => (
    <h1 className="mb-8 text-4xl font-medium" {...props}>
      {children}
    </h1>
  ),
  p: Paragraph,
  a: InlineLink,
  code: InlineCode,
  strong: (props) => <strong className="font-semibold" {...props} />,
  ...components,
});
