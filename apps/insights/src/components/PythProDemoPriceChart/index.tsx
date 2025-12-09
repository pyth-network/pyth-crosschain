import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { useAppTheme } from "@pythnetwork/react-hooks/use-app-theme";
import { capitalCase } from "change-case";
import { format } from "date-fns";
import type {
  IChartApi,
  ISeriesApi,
  LineData,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { createChart, LineSeries } from "lightweight-charts";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import classes from "./index.module.scss";
import type { AppStateContextVal } from "../../context/pyth-pro-demo";
import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type { AllDataSourcesType } from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  getColorForSymbol,
  getThemeCssVar,
  isAllowedSymbol,
} from "../../util/pyth-pro-demo";

type PythProDemoPriceChartImplProps = Pick<
  AppStateContextVal,
  "dataSourcesInUse" | "dataSourceVisibility" | "metrics" | "selectedSource"
>;

const MAX_DATA_AGE = 1000 * 60; // 1 minute
const MAX_DATA_POINTS = 3000;

export function PythProDemoPriceChartImpl({
  dataSourcesInUse,
  dataSourceVisibility,
  metrics,
  selectedSource,
}: PythProDemoPriceChartImplProps) {
  /** hooks */
  const { theme } = useAppTheme();

  /** refs */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi>(undefined);
  const seriesMapRef = useRef<Record<string, ISeriesApi<"Line">>>({});

  /** callbacks */
  const createSeriesIfNotExist = useCallback(
    (dataSource: AllDataSourcesType) => {
      if (!chartRef.current) return;

      let series = seriesMapRef.current[dataSource];
      if (!series) {
        series = chartRef.current.addSeries(LineSeries, {
          pointMarkersVisible: true,
          priceScaleId: "right",
          title: capitalCase(dataSource),
        });

        seriesMapRef.current[dataSource] = series;
      }

      const visible = dataSourceVisibility[dataSource];
      series.applyOptions({
        color: getColorForSymbol(dataSource),
        lineWidth: 2,
        lineStyle: 0, // solid
        visible,
      });

      return series;
    },
    [dataSourceVisibility],
  );

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
      autoSize: true,
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
        barSpacing: 5,
        borderColor: grayColor,
        rightOffset: 16,
        secondsVisible: true,
        tickMarkFormatter: (time: Time) => {
          const dt = time as UTCTimestamp;
          const d = new Date(dt);
          return format(d, "HH:mm:ss.SS");
        },
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

  useEffect(() => {
    if (!chartRef.current || !isAllowedSymbol(selectedSource)) {
      return;
    }

    for (const dataSource of dataSourcesInUse) {
      const latest = metrics[dataSource]?.latest;
      const symbolMetrics = latest?.[selectedSource];
      if (!symbolMetrics?.price) continue;

      const series = createSeriesIfNotExist(dataSource);
      if (!series) continue;

      const [lastPoint] = series.data().slice(-1);
      const latestMetricIsFresh =
        !lastPoint || lastPoint.time !== symbolMetrics.timestamp;

      if (!latestMetricIsFresh) continue;

      const newPoint: LineData = {
        time: symbolMetrics.timestamp as UTCTimestamp,
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
            (d.time as UTCTimestamp) >= start &&
            (d.time as UTCTimestamp) <= end,
        )
        .slice(-MAX_DATA_POINTS);

      series.setData(trimmed);
    }
  }, [
    createSeriesIfNotExist,
    dataSourceVisibility,
    dataSourcesInUse,
    metrics,
    selectedSource,
  ]);

  if (!isAllowedSymbol(selectedSource)) return;

  return (
    <div className={classes.root}>
      <div className={classes.buttons}>
        <Button
          beforeIcon={<ArrowCounterClockwise />}
          onClick={() => {
            chartRef.current?.timeScale().scrollToRealTime();
          }}
          size="xs"
          variant="outline"
        >
          Reset chart position
        </Button>
      </div>
      <div className={classes.chartContainer} ref={containerRef} />
    </div>
  );
}

export function PythProDemoPriceChart() {
  /** context */
  const { dataSourcesInUse, dataSourceVisibility, metrics, selectedSource } =
    usePythProAppStateContext();

  return (
    <PythProDemoPriceChartImpl
      dataSourcesInUse={dataSourcesInUse}
      dataSourceVisibility={dataSourceVisibility}
      key={`${selectedSource ?? "no_symbol_selected"}-${dataSourcesInUse.join(", ")}`}
      metrics={metrics}
      selectedSource={selectedSource}
    />
  );
}
