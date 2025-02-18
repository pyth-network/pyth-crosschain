import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import styles from "./index.module.scss";

type Props = ComponentProps<"div"> & {
  icon: ReactNode;
  header: ReactNode;
};

export const InfoBox = ({
  icon,
  header,
  children,
  className,
  ...props
}: Props) => (
  <div className={clsx(className, styles.infoBox)} {...props}>
    <div className={styles.icon}>{icon}</div>
    <div className={styles.body}>
      <h3 className={styles.header}>{header}</h3>
      <p className={styles.contents}>{children}</p>
    </div>
  </div>
);
