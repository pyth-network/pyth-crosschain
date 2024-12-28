import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";
import { CopyButton } from "../CopyButton";

type KeyProps = Omit<
  ComponentProps<typeof CopyButton>,
  "variant" | "text" | "children"
> & {
  publisherKey: string;
};

export const PublisherKey = ({
  publisherKey,
  className,
  ...props
}: KeyProps) => (
  <CopyButton
    variant="ghost"
    className={clsx(styles.publisherKey, className)}
    text={publisherKey}
    {...props}
  >
    {`${publisherKey.slice(0, 4)}...${publisherKey.slice(-4)}`}
  </CopyButton>
);
