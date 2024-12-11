import type { Components } from "react-markdown";

import { Code, isSupportedLanguage } from "./components/Code";
import { InlineLink } from "./components/InlineLink";
import { Styled } from "./components/Styled";

export const MARKDOWN_COMPONENTS = {
  h1: Styled("h1", "mb-8 text-4xl font-medium"),
  a: InlineLink,
  pre: (props) => {
    const firstChild = props.node?.children[0];
    if (
      props.node?.children.length === 1 &&
      firstChild &&
      "tagName" in firstChild &&
      firstChild.tagName === "code"
    ) {
      const { className } = firstChild.properties;
      const className_ = Array.isArray(className) ? className[0] : className;
      const language = /language-(\w+)/.exec(
        typeof className_ === "string" ? className_ : "",
      )?.[1];
      const codeNode = firstChild.children[0];
      return (
        <Code
          language={
            language && isSupportedLanguage(language) ? language : undefined
          }
        >
          {codeNode !== undefined && "value" in codeNode ? codeNode.value : ""}
        </Code>
      );
    } else {
      return <pre {...props} />;
    }
  },
  code: Styled(
    "code",
    "whitespace-nowrap rounded-md border border-neutral-200 bg-neutral-100 px-1 py-0.5 text-[0.9em] dark:border-neutral-700 dark:bg-neutral-800",
  ),
  strong: Styled("strong", "font-semibold"),
  ul: Styled("ul", "list-disc list-inside flex flex-col gap-1"),
  ol: Styled("ol", "list-decimal list-inside flex flex-col gap-1"),
  h3: Styled("h3", "text-lg font-semibold mt-4"),
} satisfies Components;
