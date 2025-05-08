"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useCallback, useMemo } from "react";
import { useDateFormatter, useNumberFormatter } from "react-aria";
import { ResponsiveContainer, Tooltip, Area, XAxis, YAxis } from "recharts";
import type { CategoricalChartState } from "recharts/types/chart/types";

import styles from "./ois-apy-history.module.scss";

const AreaChart = dynamic(
  () => import("recharts").then((recharts) => recharts.AreaChart),
  {
    ssr: false,
  },
);

const CHART_HEIGHT = 104;

type Props = {
  apyHistory: Point[];
};

type Point = {
  date: Date;
  apy: number;
};

export const OisApyHistory = ({ apyHistory }: Props) => {
  const [selectedPoint, setSelectedPoint] = useState<
    (typeof apyHistory)[number] | undefined
  >(undefined);
  const updateSelectedPoint = useCallback(
    (chart: CategoricalChartState) => {
      setSelectedPoint(
        (chart.activePayload as { payload: Point }[] | undefined)?.[0]?.payload,
      );
    },
    [setSelectedPoint],
  );
  const currentPoint = useMemo(
    () => selectedPoint ?? apyHistory.at(-1),
    [selectedPoint, apyHistory],
  );
  const dateFormatter = useDateFormatter();
  const numberFormatter = useNumberFormatter({ maximumFractionDigits: 2 });

  return (
    <div className={styles.oisApyHistory}>
      <h3 className={styles.oisApyHistoryHeader}>APY History</h3>
      {currentPoint && (
        <div className={styles.currentPoint}>
          <span className={styles.apy}>
            {numberFormatter.format(currentPoint.apy)}%
          </span>
          <span className={styles.date}>
            {dateFormatter.format(currentPoint.date)}
          </span>
        </div>
      )}
      <Suspense
        fallback={<div style={{ height: `${CHART_HEIGHT.toString()}px` }} />}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart
            data={apyHistory}
            className={styles.chart ?? ""}
            onMouseEnter={updateSelectedPoint}
            onMouseMove={updateSelectedPoint}
            onMouseLeave={updateSelectedPoint}
            margin={{ bottom: 0, left: 0, top: 0, right: 0 }}
          >
            <Tooltip content={() => <></>} />
            <Area
              type="monotone"
              dataKey="apy"
              dot={false}
              className={styles.chartArea ?? ""}
              stroke="currentColor"
            />
            <XAxis dataKey="date" hide />
            <YAxis hide />
          </AreaChart>
        </ResponsiveContainer>
      </Suspense>
    </div>
  );
};
