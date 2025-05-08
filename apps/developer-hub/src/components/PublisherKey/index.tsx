import type { ComponentProps } from "react";

import { CopyButton } from "../CopyButton";

type KeyProps = Omit<
  ComponentProps<typeof CopyButton>,
  "variant" | "text" | "children"
> & {
  publisherKey: string;
};

export const PublisherKey = ({ publisherKey, ...props }: KeyProps) => (
  <CopyButton text={publisherKey} {...props}>
    {`${publisherKey.slice(0, 4)}...${publisherKey.slice(-4)}`}
  </CopyButton>
);
