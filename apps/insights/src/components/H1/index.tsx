import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";

export const H1 = ({ className, children, ...props }: ComponentProps<"h1">) => (
  <h1 className={clsx(styles.h1, className)} {...props}>
    {children}
  </h1>
);
