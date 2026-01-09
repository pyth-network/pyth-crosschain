import { Spinner } from "@pythnetwork/component-library/Spinner";
import { useAppTheme } from "@pythnetwork/react-hooks/use-app-theme";
import { isNumber } from "@pythnetwork/shared-lib/util";
import { capitalCase } from "change-case";
import color from "color";
import { format } from "date-fns";
import type {
  ISeriesApi,
  LineData,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { createChart, CrosshairMode, LineSeries } from "lightweight-charts";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import classes from "./index.module.scss";
import type { AppStateContextVal } from "../../context/pyth-pro-demo";
import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type { AllDataSourcesType } from "../../schemas/pyth/pyth-pro-demo-schema";
import type { PriceData } from "../../services/clickhouse-schema";
import {
  getColorForDataSource,
  getThemeCssVar,
  isAllowedSymbol,
  isReplaySymbol,
} from "../../util/pyth-pro-demo";

type PythProDemoPriceChartImplProps = Pick<
  AppStateContextVal,
  | "chartRef"
  | "dataSourcesInUse"
  | "dataSourceVisibility"
  | "handleSetChartRef"
  | "metrics"
  | "selectedReplayDate"
  | "playbackSpeed"
  | "selectedSource"
>;

const MAX_DATA_AGE = 1000 * 60 * 5; // 5 minutes
const MAX_DATA_POINTS = 3000;

const metricsToPlot: (keyof Pick<PriceData, "ask" | "bid" | "price">)[] = [
  "ask",
  "bid",
  "price",
];

export function PythProDemoPriceChartImpl({
  chartRef,
  dataSourcesInUse,
  dataSourceVisibility,
  handleSetChartRef,
  metrics,
  selectedReplayDate,
  selectedSource,
}: PythProDemoPriceChartImplProps) {
  /** hooks */
  const { theme } = useAppTheme();

  /** refs */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesMapRef = useRef<Record<string, ISeriesApi<"Line">>>({});
  // we keep a local pointer to the chartRef
  // because data updates happen async and the chart may be trying to
  // render a datapoint even though the chart instance was disposed.
  // we do some checks to see if the chartRef available in appState
  // matches our local one, and if it does, we continue.
  const chartInstanceRef = useRef<typeof chartRef>(undefined);
  const seriesDataRef = useRef<Record<string, LineData[]>>({});

  const createSeriesIfNotExist = useCallback(
    (dataSource: AllDataSourcesType, metricType: (typeof metricsToPlot)[0]) => {
      const chartInstance = chartInstanceRef.current;
      if (!chartInstance || chartInstance !== chartRef) return;

      try {
        const seriesKey = `${dataSource}_${metricType}`;

        let series = seriesMapRef.current[seriesKey];
        if (!series) {
          series = chartInstance.addSeries(LineSeries, {
            pointMarkersVisible: true,
            priceScaleId: "right",
            title:
              `${capitalCase(dataSource)} ${metricType === "price" ? "" : `(${metricType})`}`.trim(),
          });

          seriesMapRef.current[seriesKey] = series;
          seriesDataRef.current[seriesKey] = [];
        }

        const visible = dataSourceVisibility[dataSource];
        const baseColor = color(getColorForDataSource(dataSource));
        let colorToUse = baseColor.hex();

        if (metricType === "ask") {
          colorToUse = baseColor.darken(0.4).hex();
        } else if (metricType === "bid") {
          colorToUse = baseColor.lighten(0.4).hex();
        }

        series.applyOptions({
          color: colorToUse,
          lineWidth: 2,
          lineStyle: 0, // solid
          visible,
        });

        return series;
      } catch {
        return;
      }
    },
    [chartRef, dataSourceVisibility],
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
      crosshair: {
        mode: CrosshairMode.Magnet,
      },
      layout: {
        attributionLogo: false, // hide TradingView logo
        background: { color: "transparent" },
        textColor: grayText,
      },
      localization: {
        timeFormatter(time: UTCTimestamp) {
          return format(new Date(time), "PPpp");
        },
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

    chartInstanceRef.current = chart;
    handleSetChartRef(chart);

    return () => {
      chartInstanceRef.current = undefined;
      chart.remove();
      handleSetChartRef(undefined);
      seriesMapRef.current = {};
      seriesDataRef.current = {};
    };
  }, [handleSetChartRef, theme]);

  useEffect(() => {
    if (
      !chartRef ||
      chartInstanceRef.current !== chartRef ||
      !isAllowedSymbol(selectedSource)
    ) {
      return;
    }

    try {
      for (const dataSource of dataSourcesInUse) {
        for (const metricType of metricsToPlot) {
          // we omit the price for the demo, because the Pyth
          // data will track the price.
          // for market data, we just want to display the ask and bid
          const isPriceMetric = metricType === "price";
          const isNbbo = dataSource === "nbbo";
          const isPyth = dataSource === "pyth" || dataSource === "pyth_pro";
          if ((isNbbo && isPriceMetric) || (isPyth && !isPriceMetric)) continue;

          const latest = metrics[dataSource]?.latest;
          const symbolMetrics = latest?.[selectedSource];
          const metricVal = symbolMetrics?.[metricType];
          const timestampStr = symbolMetrics?.timestamp;
          const timestamp = timestampStr
            ? new Date(timestampStr).getTime()
            : undefined;

          if (!isNumber(metricVal) || !isNumber(timestamp)) continue;
          if (metricVal < 0) continue;

          const series = createSeriesIfNotExist(dataSource, metricType);
          if (!series) continue;

          const seriesKey = `${dataSource}_${metricType}`;

          // these checks ensure that, if a user selects a different datetime
          // for visualization, that the chart has its data properly reset
          // so the chart doesn't start drawing the new data points
          // next to the existing data points, which can cause x-axis scale issues
          // and is, generally, a really weird experience
          let seriesData = seriesDataRef.current[seriesKey] ?? [];
          const lastPoint = seriesData.at(-1);
          if (
            lastPoint &&
            isNumber(lastPoint.time) &&
            timestamp < lastPoint.time
          ) {
            seriesDataRef.current[seriesKey] = [];
            seriesData = [];
            try {
              series.setData([]);
            } catch {
              continue;
            }
          }

          const lastPointAfterReset = seriesData.at(-1);
          const latestMetricIsFresh =
            !lastPointAfterReset ||
            (isNumber(lastPointAfterReset.time) &&
              lastPointAfterReset.time < timestamp);

          if (!latestMetricIsFresh) continue;

          const newPoint: LineData = {
            time: timestamp as UTCTimestamp,
            value: metricVal,
          };

          // Trim old points
          const end = timestamp;
          const start = end - MAX_DATA_AGE;

          const trimmed = [...seriesData, newPoint]
            .filter(
              (d) =>
                (d.time as UTCTimestamp) >= start &&
                (d.time as UTCTimestamp) <= end,
            )
            .slice(-MAX_DATA_POINTS);

          seriesDataRef.current[seriesKey] = trimmed;

          if (chartInstanceRef.current !== chartRef) return;

          try {
            series.setData(trimmed);
          } catch {
            continue;
          }
        }
      }
    } catch {
      /* no-op, lightweight-charts may have been destroyed midway through a write to it */
    }
  }, [
    chartRef,
    createSeriesIfNotExist,
    dataSourceVisibility,
    dataSourcesInUse,
    metrics,
    selectedSource,
  ]);

  if (!isAllowedSymbol(selectedSource)) return;

  return (
    <div className={classes.root}>
      {((isReplaySymbol(selectedSource) && selectedReplayDate) ||
        !isReplaySymbol(selectedSource)) && (
        <div className={classes.chartContainer} ref={containerRef} />
      )}
    </div>
  );
}

export function PythProDemoPriceChart() {
  /** context */
  const {
    chartRef,
    dataSourcesInUse,
    dataSourceVisibility,
    handleSetChartRef,
    isLoadingInitialReplayData,
    metrics,
    playbackSpeed,
    selectedReplayDate,
    selectedSource,
  } = usePythProAppStateContext();

  if (isReplaySymbol(selectedSource) && isLoadingInitialReplayData) {
    const label = "Loading historical replay data...";
    return (
      <div className={classes.spinner}>
        <div>{label}</div>
        <Spinner isIndeterminate label={label} />
      </div>
    );
  }

  return (
    <PythProDemoPriceChartImpl
      chartRef={chartRef}
      dataSourcesInUse={dataSourcesInUse}
      dataSourceVisibility={dataSourceVisibility}
      key={`${selectedSource}-${dataSourcesInUse.join(", ")}-${selectedReplayDate}`}
      handleSetChartRef={handleSetChartRef}
      metrics={metrics}
      playbackSpeed={playbackSpeed}
      selectedSource={selectedSource}
      selectedReplayDate={selectedReplayDate}
    />
  );
}
