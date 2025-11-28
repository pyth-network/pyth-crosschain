import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { capitalCase } from "change-case";
import {
  Chart,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";
import { formatDate } from "date-fns";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import classes from "./index.module.scss";
import type { AppStateContextVal } from "../../context/pyth-pro-demo";
import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import { getColorForSymbol, isAllowedSymbol } from "../../util/pyth-pro-demo";

Chart.register(
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  TimeScale,
);

type ChartJSPoint = { x: number; y: number };

type PythProDemoPriceChartImplProps = Pick<
  AppStateContextVal,
  "dataSourcesInUse" | "metrics" | "selectedSource"
>;

const MAX_DATA_AGE = 1000 * 60; // hold no more than one minute's worth of data in the chart
const MAX_DATA_POINTS = 3000; // don't keep more than 3K points in memory

function PythProDemoPriceChartImpl({
  dataSourcesInUse,
  metrics,
  selectedSource,
}: PythProDemoPriceChartImplProps) {
  /** state */
  const [canvasRef, setCanvasRef] =
    useState<Nullish<HTMLCanvasElement>>(undefined);

  /** refs */
  const chartHandlerRef = useRef<Nullish<Chart>>(undefined);

  /** effects */
  useEffect(() => {
    if (!canvasRef) return;
    const c = new Chart(canvasRef, {
      type: "line",
      data: { datasets: [] },
      options: {
        animation: false,
        elements: {
          point: { radius: 0 },
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: false,
            type: "linear", // push numeric timestamps or indices
            grid: { display: true },
            ticks: {
              callback(val) {
                const num = Number(val);
                const d = new Date();
                d.setTime(num);

                return formatDate(d, "pp");
              },
              display: true,
            },
          },
          y: { type: "linear", beginAtZero: false, grid: { display: true } },
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              generateLabels: (chart) => {
                // Start with the default labels
                const original =
                  Chart.defaults.plugins.legend.labels.generateLabels(chart);

                // Map them to whatever text you want
                return original.map((label) => ({
                  ...label,
                  text: capitalCase(label.text),
                }));
              },
              usePointStyle: true,
            },
          },
          tooltip: { enabled: false },
        },
      },
    });

    chartHandlerRef.current = c;
  }, [canvasRef]);

  useEffect(() => {
    if (!chartHandlerRef.current || !isAllowedSymbol(selectedSource)) return;
    const { current: c } = chartHandlerRef;

    for (const dataSource of dataSourcesInUse) {
      const latest = metrics[dataSource]?.latest;
      const symbolMetrics = latest?.[selectedSource];
      if (
        isNullOrUndefined(symbolMetrics) ||
        isNullOrUndefined(symbolMetrics.price)
      ) {
        continue;
      }

      let ds = c.data.datasets.find((d) => d.label === dataSource);
      if (!ds) {
        ds = {
          data: [],
          borderColor: getColorForSymbol(dataSource),
          label: dataSource,
          pointBorderWidth: 1,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.2,
        };
        c.data.datasets.push(ds);
      }

      const lastDataPoint = ds.data.at(-1) as Nullish<ChartJSPoint>;
      const latestMetricIsFresh =
        !lastDataPoint || lastDataPoint.x !== symbolMetrics.timestamp;

      if (!latestMetricIsFresh) return;

      ds.data.push({ x: symbolMetrics.timestamp, y: symbolMetrics.price });

      const end = symbolMetrics.timestamp;
      const start = end - MAX_DATA_AGE;

      ds.data = (ds.data as ChartJSPoint[])
        .filter((d) => d.x >= start && d.x <= end)
        .slice(-MAX_DATA_POINTS);

      // .sort() mutates the original array
      c.data.datasets.sort(
        (a, b) => a.label?.localeCompare(b.label ?? "") ?? 0,
      );
    }

    c.update();
  });

  useLayoutEffect(() => {
    return () => {
      chartHandlerRef.current?.destroy();
    };
  }, []);

  if (!isAllowedSymbol(selectedSource)) {
    return;
  }
  return (
    <div className={classes.root}>
      <canvas ref={setCanvasRef} />
    </div>
  );
}

export function PythProDemoPriceChart() {
  /** context */
  const { dataSourcesInUse, metrics, selectedSource } =
    usePythProAppStateContext();

  return (
    <PythProDemoPriceChartImpl
      dataSourcesInUse={dataSourcesInUse}
      key={`${selectedSource ?? "no_symbol_selected"}-${dataSourcesInUse.join(", ")}`}
      metrics={metrics}
      selectedSource={selectedSource}
    />
  );
}
