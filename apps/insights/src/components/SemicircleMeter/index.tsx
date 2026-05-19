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
            barSize={16}
            className={styles.chart ?? ""}
            data={[{ value: args[0].percentage }]}
            endAngle={-30}
            innerRadius="100%"
            startAngle={210}
            {...(width && { width })}
            {...(height && { height })}
          >
            <PolarAngleAxis
              angleAxisId={0}
              domain={[0, 100]}
              tick={false}
              type="number"
            />
            <RadialBar
              angleAxisId={0}
              background={{ className: styles.background }}
              className={styles.bar ?? ""}
              cornerRadius={999}
              dataKey="value"
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
