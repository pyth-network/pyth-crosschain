"use client";

import clsx from "clsx";
import type { ComponentProps, CSSProperties } from "react";

import styles from "./index.module.scss";

type Props = Omit<ComponentProps<"span">, "children"> & {
  width?: number | undefined;
  label?: string | undefined;
  fill?: boolean | undefined;
};

export const Skeleton = ({ className, label, width, fill, ...props }: Props) =>
  fill ? (
    <span className={clsx(styles.fullSkeleton, className)} {...props}>
      <Label>{label ?? "Loading"}</Label>
    </span>
  ) : (
    <span
      data-fill-width={width === undefined ? "" : undefined}
      {...(width && { style: { "--skeleton-width": width } as CSSProperties })}
      className={clsx(styles.skeleton, { [className ?? ""]: fill })}
    >
      <span className={clsx(styles.skeletonInner, className)} {...props}>
        <Label>{label ?? "Loading"}</Label>
      </span>
    </span>
  );

const Label = ({ children }: { children: string | undefined }) => (
  <span className={styles.skeletonLabel}>{children ?? "Loading"}</span>
);
