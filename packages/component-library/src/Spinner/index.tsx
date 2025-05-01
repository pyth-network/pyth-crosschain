"use client";

import clsx from "clsx";
import type { ComponentProps } from "react";
import { ProgressBar } from "react-aria-components";

import styles from "./index.module.scss";

type OwnProps = {
  label: string;
};
type Props = Omit<ComponentProps<typeof ProgressBar>, keyof OwnProps> &
  OwnProps;

export const Spinner = ({ label, className, ...props }: Props) => (
  <ProgressBar
    aria-label={label}
    className={clsx(styles.spinnerContainer, className)}
    {...props}
  >
    {({ percentage }) => (
      <>
        <svg
          width="1em"
          height="1em"
          viewBox="0 0 32 32"
          fill="none"
          className={styles.spinner}
          strokeWidth={4}
        >
          <circle cx={16} cy={16} r={12} className={styles.background} />
          <circle
            cx={16}
            cy={16}
            r={12}
            className={styles.indicator}
            strokeDasharray={`${c.toString()} ${c.toString()}`}
            strokeDashoffset={c - ((percentage ?? 10) / 100) * c}
            strokeLinecap="round"
          />
        </svg>
      </>
    )}
  </ProgressBar>
);

const c = 24 * Math.PI;
