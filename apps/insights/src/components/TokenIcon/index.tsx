"use client";

import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";
import Logo from "./logo.svg";

type Props = Omit<ComponentProps<"span">, "children">;

export const TokenIcon = ({ className, ...props }: Props) => (
  <span className={clsx(styles.tokenIcon, className)} {...props}>
    <div className={styles.logoContainer}>
      <Logo className={styles.logo} />
    </div>
  </span>
);
