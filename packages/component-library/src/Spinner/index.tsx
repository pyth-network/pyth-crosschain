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
          className={styles.spinner}
          fill="none"
          height="1em"
          strokeWidth={4}
          viewBox="0 0 32 32"
          width="1em"
        >
          <circle className={styles.background} cx={16} cy={16} r={12} />
          <circle
            className={styles.indicator}
            cx={16}
            cy={16}
            r={12}
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
