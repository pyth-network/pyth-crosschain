import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";

type StatsProps = {
  children: React.ReactNode;
} & ComponentProps<"div">;

export const Stats = ({ children, ...props }: StatsProps) => {
  return (
    <div className={clsx(styles.statsContainer, props.className)} {...props}>
      <div className={styles.statScrollWrapper}>
        <div className={styles.statsItemsContainer}>{children}</div>
      </div>
    </div>
  );
};
