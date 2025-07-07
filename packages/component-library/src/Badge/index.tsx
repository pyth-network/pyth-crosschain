"use client";

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
  "muted",
] as const;
export const STYLES = ["filled", "outline"] as const;
export const SIZES = ["xs", "md", "lg"] as const;

type Props = ComponentProps<"span"> & {
  variant?: (typeof VARIANTS)[number] | undefined;
  style?: (typeof STYLES)[number] | undefined;
  size?: (typeof SIZES)[number] | undefined;
};

export const Badge = ({
  className,
  variant = "neutral",
  size = "md",
  style = "filled",
  children,
  ...props
}: Props) => (
  <span
    className={clsx(styles.badge, className)}
    data-variant={variant}
    data-size={size}
    data-style={style}
    {...props}
  >
    {children}
  </span>
);
