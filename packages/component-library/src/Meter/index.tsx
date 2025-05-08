"use client";

import { Meter as MeterComponent } from "@pythnetwork/component-library/unstyled/Meter";
import type { ComponentProps, ReactNode } from "react";

import styles from "./index.module.scss";

type OwnProps = {
  label: string;
  startLabel?: ReactNode | undefined;
  endLabel?: ReactNode | undefined;
  labelClassName?: string | undefined;
  variant?: "default" | "error";
};
type Props = Omit<ComponentProps<typeof MeterComponent>, keyof OwnProps> &
  OwnProps;

export const Meter = ({
  label,
  startLabel,
  endLabel,
  labelClassName,
  variant = "default",
  ...props
}: Props) => (
  <MeterComponent aria-label={label} {...props}>
    {({ percentage }) => (
      <div data-variant={variant} className={styles.meter}>
        {(startLabel !== undefined || endLabel !== undefined) && (
          <div className={styles.labels}>
            <div className={labelClassName}>{startLabel}</div>
            <div className={labelClassName}>{endLabel}</div>
          </div>
        )}
        <div className={styles.score}>
          <div
            className={styles.fill}
            style={{ width: `${percentage.toString()}%` }}
          />
        </div>
      </div>
    )}
  </MeterComponent>
);
