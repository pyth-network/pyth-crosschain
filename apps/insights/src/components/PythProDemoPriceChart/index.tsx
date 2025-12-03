import { capitalCase } from "change-case";
import type {
  IChartApi,
  ISeriesApi,
  LineData,
  UTCTimestamp,
} from "lightweight-charts";
import { createChart, LineSeries } from "lightweight-charts";
import { useTheme } from "next-themes";
import { useEffect, useLayoutEffect, useRef } from "react";

import type { AppStateContextVal } from "../../context/pyth-pro-demo";
import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import {
  getColorForSymbol,
  getThemeCssVar,
  isAllowedSymbol,
} from "../../util/pyth-pro-demo";

type PythProDemoPriceChartImplProps = Pick<
  AppStateContextVal,
  "dataSourcesInUse" | "metrics" | "selectedSource"
>;

const MAX_DATA_AGE = 1000 * 60; // 1 minute
const MAX_DATA_POINTS = 3000;

export function PythProDemoPriceChartImpl({
  dataSourcesInUse,
  metrics,
  selectedSource,
}: PythProDemoPriceChartImplProps) {
  /** hooks */
  const { theme } = useTheme();

  /** refs */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi>(undefined);
  const seriesMapRef = useRef<Record<string, ISeriesApi<"Line">>>({});

  /** effects */
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const grayColor =
      theme === "dark"
        ? (getThemeCssVar("--theme-palette-gray-800") ?? "#ccc")
        : (getThemeCssVar("--theme-palette-gray-300") ?? "#f1f1f3");
    const grayText =
      theme === "dark"
        ? (getThemeCssVar("--theme-palette-gray-300") ?? "#f1f1f3")
        : (getThemeCssVar("--theme-palette-gray-800") ?? "#ccc");

    const chart = createChart(containerRef.current, {
      layout: {
        attributionLogo: false, // hide TradingView logo
        background: { color: "transparent" },
        textColor: grayText,
      },
      grid: {
        horzLines: { color: grayColor },
        vertLines: { color: grayColor },
      },
      rightPriceScale: {
        borderColor: grayColor,
      },
      timeScale: {
        barSpacing: 3,
        borderColor: grayColor,
        rightOffset: 0,
        secondsVisible: true,
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = undefined;
      seriesMapRef.current = {};
    };
  }, [theme]);

  useLayoutEffect(() => {
    if (!chartRef.current || !containerRef.current) return;
    const { current: chartApi } = chartRef;

    const o = new ResizeObserver(([entry]) => {
      if (!entry) return;

      const {
        contentRect: { height, width },
      } = entry;
      chartApi.resize(width, height);
    });

    o.observe(containerRef.current);

    return () => {
      o.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !isAllowedSymbol(selectedSource)) return;

    for (const dataSource of dataSourcesInUse) {
      const latest = metrics[dataSource]?.latest;
      const symbolMetrics = latest?.[selectedSource];
      if (!symbolMetrics?.price) continue;

      let series = seriesMapRef.current[dataSource];
      if (!series) {
        series = chartRef.current.addSeries(LineSeries, {
          priceScaleId: "right",
          title: capitalCase(dataSource),
        });
        series.applyOptions({
          color: getColorForSymbol(dataSource),
          lineWidth: 2,
          lineStyle: 0, // solid
        });
        seriesMapRef.current[dataSource] = series;
      }

      const [lastPoint] = series.data().slice(-1);
      const latestMetricIsFresh =
        !lastPoint ||
        lastPoint.time !== Math.floor(symbolMetrics.timestamp / 1000);

      if (!latestMetricIsFresh) continue;

      const newPoint: LineData = {
        time: Math.floor(symbolMetrics.timestamp / 1000) as UTCTimestamp,
        value: symbolMetrics.price,
      };

      series.update(newPoint);

      // Trim old points
      const end = symbolMetrics.timestamp;
      const start = end - MAX_DATA_AGE;

      const allData = series.data();
      const trimmed = allData
        .filter(
          (d) =>
            (d.time as UTCTimestamp) * 1000 >= start &&
            (d.time as UTCTimestamp) * 1000 <= end,
        )
        .slice(-MAX_DATA_POINTS);

      series.setData(trimmed);

      // Update visible range so chart fills left-to-right
      chartRef.current.timeScale().setVisibleRange({
        from: Math.floor(start / 1000) as UTCTimestamp,
        to: Math.floor(end / 1000) as UTCTimestamp,
      });
    }
  });

  if (!isAllowedSymbol(selectedSource)) return;

  return <div ref={containerRef} style={{ width: "100%", height: "400px" }} />;
}

export function PythProDemoPriceChart() {
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
