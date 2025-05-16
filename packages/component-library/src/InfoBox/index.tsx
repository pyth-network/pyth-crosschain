import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import styles from "./index.module.scss";

export const VARIANTS = [
  "neutral",
  "info",
  "warning",
  "error",
  "data",
  "success",
] as const;

type Props = ComponentProps<"div"> & {
  icon: ReactNode;
  header: ReactNode;
  variant?: (typeof VARIANTS)[number] | undefined;
};

export const InfoBox = ({
  icon,
  header,
  children,
  className,
  variant = "info",
  ...props
}: Props) => (
  <div
    className={clsx(className, styles.infoBox)}
    data-variant={variant}
    {...props}
  >
    <div className={styles.icon}>{icon}</div>
    <div className={styles.body}>
      <h3 className={styles.header}>{header}</h3>
      <div className={styles.contents}>{children}</div>
    </div>
  </div>
);
