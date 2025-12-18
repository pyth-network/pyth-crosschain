"use client";

import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";

import styles from "./chart-hover-card.module.scss";

export type ChartHoverCardProps = ComponentPropsWithRef<"div"> & {
  timestamp?: string;
  price?: string;
  confidence?: string;
};

export function ChartHoverCard({
  timestamp,
  price,
  confidence,
  className,
  ...props
}: ChartHoverCardProps) {
  return (
    <div className={clsx(className, styles.hoverCard)} {...props}>
      <table className={styles.hoverCardTable}>
        <tbody>
          <tr>
            <td colSpan={2}>{timestamp}</td>
          </tr>
          <tr>
            <td>Price</td>
            <td>{price}</td>
          </tr>
          {confidence && (
            <tr>
              <td>Confidence</td>
              <td>{confidence}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
