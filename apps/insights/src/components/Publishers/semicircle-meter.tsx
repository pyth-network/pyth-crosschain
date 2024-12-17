"use client";

import dynamic from "next/dynamic";
import { type ComponentProps, Suspense } from "react";
import { Meter } from "react-aria-components";
import { PolarAngleAxis, RadialBar } from "recharts";

export { Label } from "react-aria-components";

const RadialBarChart = dynamic(
  () => import("recharts").then((recharts) => recharts.RadialBarChart),
  {
    ssr: false,
  },
);

type OwnProps = Pick<
  ComponentProps<typeof RadialBarChart>,
  "width" | "height"
> & {
  chartClassName?: string | undefined;
  barClassName?: string | undefined;
  backgroundClassName?: string | undefined;
};

type Props = Omit<ComponentProps<typeof Meter>, keyof OwnProps> & OwnProps;

export const SemicircleMeter = ({
  width,
  height,
  chartClassName,
  barClassName,
  backgroundClassName,
  children,
  ...props
}: Props) => (
  <Meter {...props}>
    {({ percentage }) => (
      <>
        <Suspense>
          <Chart
            percentage={percentage}
            chartClassName={chartClassName}
            backgroundClassName={backgroundClassName}
            barClassName={barClassName}
            {...(width && { width })}
            {...(height && { height })}
          />
        </Suspense>
        {children}
      </>
    )}
  </Meter>
);

type ChartProps = Pick<
  Props,
  "width" | "height" | "chartClassName" | "backgroundClassName" | "barClassName"
> & {
  percentage: number;
};

const Chart = ({
  width,
  height,
  percentage,
  chartClassName,
  backgroundClassName,
  barClassName,
}: ChartProps) => (
  <RadialBarChart
    data={[{ value: percentage }]}
    innerRadius="100%"
    startAngle={210}
    endAngle={-30}
    barSize={16}
    className={chartClassName ?? ""}
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
      background={{ className: backgroundClassName }}
      dataKey="value"
      className={barClassName ?? ""}
      cornerRadius={999}
    />
  </RadialBarChart>
);
