import { InlineCode } from "./components/InlineCode";
import { InlineLink } from "./components/InlineLink";
import { Paragraph } from "./components/Paragraph";
import { Styled } from "./components/Styled";

export const MARKDOWN_COMPONENTS = {
  h1: Styled("h1", "mb-8 text-4xl font-medium"),
  p: Paragraph,
  a: InlineLink,
  code: InlineCode,
  strong: Styled("strong", "font-semibold"),
};
