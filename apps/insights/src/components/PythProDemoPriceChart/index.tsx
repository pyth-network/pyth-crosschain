import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { useAppTheme } from "@pythnetwork/react-hooks/use-app-theme";
import { isNumber } from "@pythnetwork/shared-lib/util";
import { capitalCase } from "change-case";
import color from "color";
import { format } from "date-fns";
import type {
  IChartApi,
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
import type {
  AllDataSourcesType,
  PriceData,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  getColorForDataSource,
  getThemeCssVar,
  isAllowedSymbol,
  isReplaySymbol,
} from "../../util/pyth-pro-demo";

type PythProDemoPriceChartImplProps = Pick<
  AppStateContextVal,
  | "dataSourcesInUse"
  | "dataSourceVisibility"
  | "handleSelectPlaybackSpeed"
  | "metrics"
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
  dataSourcesInUse,
  dataSourceVisibility,
  handleSelectPlaybackSpeed,
  metrics,
  playbackSpeed,
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
    (dataSource: AllDataSourcesType, metricType: (typeof metricsToPlot)[0]) => {
      if (!chartRef.current) return;

      try {
        const seriesKey = `${dataSource}_${metricType}`;

        let series = seriesMapRef.current[seriesKey];
        if (!series) {
          series = chartRef.current.addSeries(LineSeries, {
            pointMarkersVisible: true,
            priceScaleId: "right",
            title:
              `${capitalCase(dataSource)} ${metricType === "price" ? "" : `(${metricType})`}`.trim(),
          });

          seriesMapRef.current[seriesKey] = series;
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
    [dataSourceVisibility],
  );

  const createSelectPlaybackSpeed = useCallback(
    (speed: typeof playbackSpeed) => () => {
      if (speed === playbackSpeed) return;

      handleSelectPlaybackSpeed(speed);
    },
    [handleSelectPlaybackSpeed, playbackSpeed],
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

          const [lastPoint] = series.data().slice(-1);
          const latestMetricIsFresh =
            !lastPoint || lastPoint.time !== timestamp;

          if (!latestMetricIsFresh) continue;

          const newPoint: LineData = {
            time: timestamp as UTCTimestamp,
            value: metricVal,
          };

          try {
            series.update(newPoint);
          } catch {
            continue;
          }

          // Trim old points
          const end = timestamp;
          const start = end - MAX_DATA_AGE;

          const allData = series.data();
          const trimmed = allData
            .filter(
              (d) =>
                (d.time as UTCTimestamp) >= start &&
                (d.time as UTCTimestamp) <= end,
            )
            .slice(-MAX_DATA_POINTS);

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
        {isReplaySymbol(selectedSource) && (
          <>
            <Button
              onClick={createSelectPlaybackSpeed(1)}
              size="xs"
              variant={playbackSpeed === 1 ? "success" : "outline"}
            >
              1x
            </Button>
            <Button
              onClick={createSelectPlaybackSpeed(4)}
              size="xs"
              variant={playbackSpeed === 4 ? "success" : "outline"}
            >
              4x
            </Button>
            <Button
              onClick={createSelectPlaybackSpeed(8)}
              size="xs"
              variant={playbackSpeed === 8 ? "success" : "outline"}
            >
              8x
            </Button>
            <Button
              onClick={createSelectPlaybackSpeed(16)}
              size="xs"
              variant={playbackSpeed === 16 ? "success" : "outline"}
            >
              16x
            </Button>
            <Button
              onClick={createSelectPlaybackSpeed(32)}
              size="xs"
              variant={playbackSpeed === 32 ? "success" : "outline"}
            >
              32x
            </Button>
            <div className={classes.verticalDivider} />
          </>
        )}
        <Button
          beforeIcon={<ArrowCounterClockwise />}
          onClick={() => {
            try {
              chartRef.current?.timeScale().scrollToRealTime();
            } catch {
              /* no-op */
            }
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
  const {
    dataSourcesInUse,
    dataSourceVisibility,
    handleSelectPlaybackSpeed,
    metrics,
    playbackSpeed,
    selectedSource,
  } = usePythProAppStateContext();

  return (
    <PythProDemoPriceChartImpl
      dataSourcesInUse={dataSourcesInUse}
      dataSourceVisibility={dataSourceVisibility}
      key={`${selectedSource ?? "no_symbol_selected"}-${dataSourcesInUse.join(", ")}`}
      handleSelectPlaybackSpeed={handleSelectPlaybackSpeed}
      metrics={metrics}
      playbackSpeed={playbackSpeed}
      selectedSource={selectedSource}
    />
  );
}
