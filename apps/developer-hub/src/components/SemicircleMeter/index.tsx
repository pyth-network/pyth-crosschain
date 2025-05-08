"use client";

import { Meter } from "@pythnetwork/component-library/unstyled/Meter";
import clsx from "clsx";
import dynamic from "next/dynamic";
import type { ComponentProps, CSSProperties } from "react";
import { Suspense } from "react";
import { PolarAngleAxis, RadialBar } from "recharts";

import styles from "./index.module.scss";

export { Label } from "@pythnetwork/component-library/unstyled/Label";

const RadialBarChart = dynamic(
  () => import("recharts").then((recharts) => recharts.RadialBarChart),
  {
    ssr: false,
  },
);

type OwnProps = {
  height: number;
  width: number;
};

type Props = Omit<ComponentProps<typeof Meter>, keyof OwnProps> & OwnProps;

export const SemicircleMeter = ({
  width,
  height,
  className,
  children,
  ...props
}: Props) => (
  <Meter
    className={clsx(styles.semicircleChart, className)}
    style={{ "--height": `${height.toString()}px` } as CSSProperties}
    {...props}
  >
    {(...args) => (
      <>
        <Suspense>
          <RadialBarChart
            data={[{ value: args[0].percentage }]}
            innerRadius="100%"
            startAngle={210}
            endAngle={-30}
            barSize={16}
            className={styles.chart ?? ""}
            {...(width && { width })}
            {...(height && { height })}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              angleAxisId={0}
              background={{ className: styles.background }}
              dataKey="value"
              className={styles.bar ?? ""}
              cornerRadius={999}
            />
          </RadialBarChart>
        </Suspense>
        <div className={styles.legend}>
          {typeof children === "function" ? children(...args) : children}
        </div>
      </>
    )}
  </Meter>
);
