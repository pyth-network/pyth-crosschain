"use client";

import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { Meter } from "@pythnetwork/component-library/unstyled/Meter";
import clsx from "clsx";
import type { CSSProperties } from "react";

import styles from "./index.module.scss";

const SCORE_WIDTH = 24;

type Props = {
  width?: number | undefined;
  fill?: boolean | undefined;
  className?: string | undefined;
} & (
  | { isLoading: true }
  | {
      isLoading?: false;
      score: number;
    }
);

export const Score = ({ width, fill, className, ...props }: Props) =>
  props.isLoading ? (
    <Skeleton
      className={clsx(className, styles.score)}
      fill
      data-fill={fill ? "" : undefined}
      {...(!fill && {
        style: { "--width": width ?? SCORE_WIDTH } as CSSProperties,
      })}
    />
  ) : (
    <Meter
      className={clsx(className, styles.meter)}
      value={props.score}
      maxValue={1}
      aria-label="Score"
      data-fill={fill ? "" : undefined}
      {...(!fill && {
        style: { "--width": width ?? SCORE_WIDTH } as CSSProperties,
      })}
    >
      {({ percentage }) => (
        <div
          className={styles.score}
          data-size-class={getSizeClass(percentage)}
        >
          <div
            className={styles.fill}
            style={{ width: `${(50 + percentage / 2).toString()}%` }}
          >
            {props.score.toFixed(2)}
          </div>
        </div>
      )}
    </Meter>
  );

const getSizeClass = (percentage: number) => {
  if (percentage < 60) {
    return "bad";
  } else if (percentage < 70) {
    return "weak";
  } else if (percentage < 80) {
    return "warn";
  } else if (percentage < 90) {
    return "ok";
  } else {
    return "good";
  }
};
