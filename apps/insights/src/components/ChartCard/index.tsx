"use client";

import { StatCard } from "@pythnetwork/component-library/StatCard";
import clsx from "clsx";
import dynamic from "next/dynamic";
import type { ComponentProps, ElementType, ReactNode } from "react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  const updateSelectedPoint = useCallback((chart: CategoricalChartState) => {
    setSelectedPoint(
      (chart.activePayload as { payload: Point<U> }[] | undefined)?.[0]
        ?.payload,
    );
  }, []);

  return (
    <StatCard
      className={clsx(className, styles.chartCard)}
      {...props}
      miniStat={selectedDate ?? miniStat}
      stat={selectedPoint ? (selectedPoint.displayY ?? selectedPoint.y) : stat}
    >
      <Suspense
        fallback={<div style={{ height: `${CHART_HEIGHT.toString()}px` }} />}
      >
        <ResponsiveContainer height={CHART_HEIGHT} width="100%">
          <LineChart
            className={chartClassName ?? ""}
            data={data}
            onMouseEnter={updateSelectedPoint}
            onMouseLeave={updateSelectedPoint}
            onMouseMove={updateSelectedPoint}
          >
            <Tooltip content={() => <></>} />
            <Line
              className={styles.line ?? ""}
              dataKey="y"
              dot={false}
              stroke="currentColor"
              type="monotone"
            />
            <XAxis dataKey="date" hide />
            <YAxis domain={domain} hide />
          </LineChart>
        </ResponsiveContainer>
      </Suspense>
    </StatCard>
  );
};
