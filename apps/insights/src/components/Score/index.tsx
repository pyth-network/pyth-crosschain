"use client";

import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import type { CSSProperties } from "react";
import { Meter } from "react-aria-components";

import styles from "./index.module.scss";

const SCORE_WIDTH = 24;

type Props = {
  width?: number | undefined;
} & (
  | { isLoading: true }
  | {
      isLoading?: false;
      score: number;
    }
);

export const Score = ({ width, ...props }: Props) =>
  props.isLoading ? (
    <Skeleton
      className={styles.score}
      fill
      style={{ "--width": width ?? SCORE_WIDTH } as CSSProperties}
    />
  ) : (
    <Meter
      value={props.score}
      maxValue={1}
      style={{ "--width": width ?? SCORE_WIDTH } as CSSProperties}
      aria-label="Score"
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
