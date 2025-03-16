import type { ComponentProps } from "react";
import MarkdownComponent from "react-markdown";

import { MARKDOWN_COMPONENTS } from "../../markdown-components";

type Props = Omit<ComponentProps<typeof MarkdownComponent>, "components"> & {
  inline?: boolean | undefined;
};

export const Markdown = ({ inline, ...props }: Props) =>
  inline ? (
    <MarkdownComponent
      components={{
        ...MARKDOWN_COMPONENTS,
        p: ({ children }) => <>{children}</>,
      }}
      {...props}
    />
  ) : (
    <div className="flex flex-col gap-4">
      <MarkdownComponent components={MARKDOWN_COMPONENTS} {...props} />
    </div>
  );
