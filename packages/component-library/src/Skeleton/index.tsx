import clsx from "clsx";
import type { ComponentProps, CSSProperties } from "react";

import styles from "./index.module.scss";

type Props = Omit<ComponentProps<"span">, "children"> & {
  width?: number | undefined;
  label?: string | undefined;
  round?: boolean | undefined;
};

export const Skeleton = ({
  className,
  label,
  width,
  round,
  ...props
}: Props) => (
  <span
    data-fill={width === undefined ? "" : undefined}
    data-round={round ? "" : undefined}
    {...(width && { style: { "--skeleton-width": width } as CSSProperties })}
    className={styles.skeleton}
  >
    <span className={clsx(styles.skeletonInner, className)} {...props}>
      <span className={styles.skeletonLabel}>{label ?? "Loading"}</span>
    </span>
  </span>
);
