"use client";

import { StatCard } from "@pythnetwork/component-library/StatCard";
import clsx from "clsx";
import dynamic from "next/dynamic";
import type { ElementType, ComponentProps, ReactNode } from "react";
import { Suspense, useState, useMemo, useCallback } from "react";
import { ResponsiveContainer, Tooltip, Line, XAxis, YAxis } from "recharts";
import type { CategoricalChartState } from "recharts/types/chart/types";

import styles from "./index.module.scss";

const LineChart = dynamic(
  () => import("recharts").then((recharts) => recharts.LineChart),
  {
    ssr: false,
  },
);

const CHART_HEIGHT = 36;

type OwnProps<T> = {
  chartClassName?: string | undefined;
  data: Point<T>[];
};

type Point<T> = {
  x: T;
  y: number;
  displayX?: ReactNode | undefined;
  displayY?: ReactNode | undefined;
};

type Props<T extends ElementType, U> = Omit<
  ComponentProps<typeof StatCard<T>>,
  keyof OwnProps<U> | "children"
> &
  OwnProps<U>;

export const ChartCard = <T extends ElementType, U>({
  className,
  chartClassName,
  data,
  stat,
  miniStat,
  ...props
}: Props<T, U>) => {
  const [selectedPoint, setSelectedPoint] = useState<undefined | Point<U>>(
    undefined,
  );
  const selectedDate = useMemo(
    () =>
      selectedPoint ? (selectedPoint.displayX ?? selectedPoint.x) : undefined,
    [selectedPoint],
  );
  const domain = useMemo(
    () => [
      Math.min(...data.map((point) => point.y)),
      Math.max(...data.map((point) => point.y)),
    ],
    [data],
  );
  const updateSelectedPoint = useCallback(
    (chart: CategoricalChartState) => {
      setSelectedPoint(
        (chart.activePayload as { payload: Point<U> }[] | undefined)?.[0]
          ?.payload,
      );
    },
    [setSelectedPoint],
  );

  return (
    <StatCard
      className={clsx(className, styles.chartCard)}
      {...props}
      stat={selectedPoint ? (selectedPoint.displayY ?? selectedPoint.y) : stat}
      miniStat={selectedDate ?? miniStat}
    >
      <Suspense
        fallback={<div style={{ height: `${CHART_HEIGHT.toString()}px` }} />}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart
            className={chartClassName ?? ""}
            data={data}
            onMouseEnter={updateSelectedPoint}
            onMouseMove={updateSelectedPoint}
            onMouseLeave={updateSelectedPoint}
          >
            <Tooltip content={() => <></>} />
            <Line
              type="monotone"
              dataKey="y"
              className={styles.line ?? ""}
              stroke="currentColor"
              dot={false}
            />
            <XAxis dataKey="date" hide />
            <YAxis hide domain={domain} />
          </LineChart>
        </ResponsiveContainer>
      </Suspense>
    </StatCard>
  );
};
