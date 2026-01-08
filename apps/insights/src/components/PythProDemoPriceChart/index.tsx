import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { DatePicker } from "@pythnetwork/component-library/DatePicker";
import { Select } from "@pythnetwork/component-library/Select";
import { Spinner } from "@pythnetwork/component-library/Spinner";
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
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Tooltip, TooltipTrigger } from "react-aria-components";

import classes from "./index.module.scss";
import type { AppStateContextVal } from "../../context/pyth-pro-demo";
import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type { AllDataSourcesType } from "../../schemas/pyth/pyth-pro-demo-schema";
import { ALLOWED_PLAYBACK_SPEEDS } from "../../schemas/pyth/pyth-pro-demo-schema";
import type { PriceData } from "../../services/clickhouse-schema";
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
  | "handleSetSelectedReplayDate"
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
  dataSourcesInUse,
  dataSourceVisibility,
  handleSelectPlaybackSpeed,
  handleSetSelectedReplayDate,
  metrics,
  playbackSpeed,
  selectedReplayDate,
  selectedSource,
}: PythProDemoPriceChartImplProps) {
  /** hooks */
  const { theme } = useAppTheme();

  /** state */
  const [datepickerOpen, setDatepickerOpen] = useState(false);

  /** refs */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi>(undefined);
  const seriesMapRef = useRef<Record<string, ISeriesApi<"Line">>>({});

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

  const selectPlaybackSpeed = useCallback(
    (speed: typeof playbackSpeed) => {
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
            <TooltipTrigger
              delay={0}
              isOpen={
                isReplaySymbol(selectedSource) &&
                !selectedReplayDate &&
                !datepickerOpen
              }
            >
              <DatePicker
                onChange={handleSetSelectedReplayDate}
                onDatepickerOpenCloseChange={setDatepickerOpen}
                placeholder="Select a datetime to begin"
                type="datetime"
                value={selectedReplayDate}
              />
              <Tooltip
                className={classes.selectDateAndTimeMsg ?? ""}
                placement="bottom end"
              >
                Select a date and time to continue
              </Tooltip>
            </TooltipTrigger>
            <div className={classes.verticalDivider} />
            <Select
              label={undefined}
              onSelectionChange={selectPlaybackSpeed}
              options={[...ALLOWED_PLAYBACK_SPEEDS].map((speed) => ({
                id: speed,
              }))}
              placeholder="Choose a playback speed"
              selectedKey={playbackSpeed}
              show={({ id: speed }) => `${speed.toString()}x`}
              size="sm"
              textValue={({ id: speed }) => `Speed: ${speed.toString()}x`}
            />
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
          size="sm"
          variant="outline"
        >
          Reset chart position
        </Button>
      </div>
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
    dataSourcesInUse,
    dataSourceVisibility,
    handleSelectPlaybackSpeed,
    handleSetSelectedReplayDate,
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
      dataSourcesInUse={dataSourcesInUse}
      dataSourceVisibility={dataSourceVisibility}
      key={`${selectedSource}-${dataSourcesInUse.join(", ")}-${selectedReplayDate}`}
      handleSelectPlaybackSpeed={handleSelectPlaybackSpeed}
      handleSetSelectedReplayDate={handleSetSelectedReplayDate}
      metrics={metrics}
      playbackSpeed={playbackSpeed}
      selectedSource={selectedSource}
      selectedReplayDate={selectedReplayDate}
    />
  );
}
