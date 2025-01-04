import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";

export const VARIANTS = [
  "neutral",
  "info",
  "warning",
  "error",
  "data",
  "success",
  "disabled",
] as const;
export const STYLES = ["filled", "outline"] as const;
export const SIZES = ["xs", "md"] as const;

type Props = ComponentProps<"span"> & {
  variant?: (typeof VARIANTS)[number] | undefined;
  style?: (typeof STYLES)[number] | undefined;
  size?: (typeof SIZES)[number] | undefined;
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
