import clsx from "clsx";
import type { ReactNode, ElementType } from "react";

import styles from "./index.module.scss";
import { type Props as CardProps, Card } from "../Card/index.js";

type Props<T extends ElementType> = Omit<
  CardProps<T>,
  "title" | "toolbar" | "icon" | "footer"
> & {
  header: ReactNode;
  stat: ReactNode;
  miniStat?: ReactNode | undefined;
};

export const StatCard = <T extends ElementType>({
  header,
  stat,
  miniStat,
  className,
  ...props
}: Props<T>) => (
  <Card className={clsx(styles.statCard, className)} {...props}>
    <div className={styles.cardContents}>
      <h2 className={styles.header}>{header}</h2>
      <div className={styles.bottom}>
        <div className={styles.stat}>{stat}</div>
        {miniStat && <div className={styles.miniStat}>{miniStat}</div>}
      </div>
    </div>
  </Card>
);
