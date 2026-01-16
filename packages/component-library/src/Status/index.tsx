import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";

export const STATUS_VARIANTS = [
  "neutral",
  "info",
  "warning",
  "error",
  "data",
  "success",
  "disabled",
] as const;
export const STATUS_STYLES = ["filled", "outline"] as const;
export const STATUS_SIZES = ["xs", "md"] as const;

type Props = ComponentProps<"span"> & {
  variant?: (typeof STATUS_VARIANTS)[number] | undefined;
  style?: (typeof STATUS_STYLES)[number] | undefined;
  size?: (typeof STATUS_SIZES)[number] | undefined;
};

export const Status = ({
  className,
  variant = "neutral",
  size = "md",
  style = "filled",
  children,
  ...props
}: Props) => (
  <span
    className={clsx(styles.status, className)}
    data-variant={variant}
    data-size={size}
    data-style={style}
    {...props}
  >
    <span className={styles.dot} />
    <span className={styles.text}>{children}</span>
  </span>
);
