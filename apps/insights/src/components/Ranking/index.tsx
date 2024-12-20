import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";

type OwnProps = {
  isLoading?: boolean | undefined;
};

type Props = Omit<ComponentProps<"span">, keyof OwnProps> & OwnProps;

export const Ranking = ({
  isLoading,
  className,
  children,
  ...props
}: Props) => (
  <span className={clsx(styles.ranking, className)} {...props}>
    {isLoading ? (
      <Skeleton fill className={styles.skeleton} />
    ) : (
      <div className={styles.content}>{children}</div>
    )}
  </span>
);
