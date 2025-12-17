"use client";

import clsx from "clsx";
import type { ComponentProps, CSSProperties } from "react";

import styles from "./index.module.scss";

type Props = Omit<ComponentProps<"span">, "children"> & {
  width?: number | undefined;
  label?: string | undefined;
  fill?: boolean | undefined;
};

export const Skeleton = ({
  className,
  label,
  width,
  fill,
  ...props
}: Props) => (
  <span
    data-fill-width={width === undefined ? "" : undefined}
    {...(width &&
      !fill && { style: { "--skeleton-width": width } as CSSProperties })}
    data-fill={fill ? "" : undefined}
    className={clsx(styles.skeleton, className)}
  >
    <span className={clsx(styles.skeletonInner, className)} {...props}>
      <Label>{label ?? "Loading"}</Label>
    </span>
  </span>
);

const Label = ({ children }: { children: string | undefined }) => (
  <span className={styles.skeletonLabel}>{children ?? "Loading"}</span>
);
