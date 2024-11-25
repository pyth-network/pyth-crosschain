import clsx from "clsx";
import type { ComponentProps, CSSProperties } from "react";

import styles from "./index.module.scss";

type Props = Omit<ComponentProps<"span">, "children"> & {
  width: number;
  label?: string | undefined;
};

export const Skeleton = ({ className, label, width, ...props }: Props) => (
  <span className={styles.skeleton}>
    <span
      style={{ "--skeleton-width": width } as CSSProperties}
      className={clsx(styles.skeletonInner, className)}
      {...props}
    >
      <span className={styles.skeletonLabel}>{label ?? "Loading"}</span>
    </span>
  </span>
);
