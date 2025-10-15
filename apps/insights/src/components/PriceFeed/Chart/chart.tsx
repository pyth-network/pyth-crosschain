"use client";

import { PriceStatus } from "@pythnetwork/client";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useResizeObserver, useMountEffect } from "@react-hookz/web";
import {
  startOfMinute,
  startOfHour,
  startOfDay,
  startOfSecond,
} from "date-fns";
import type {
  IChartApi,
  ISeriesApi,
  LineData,
  Time,
  UTCTimestamp,
  WhitespaceData,
} from "lightweight-charts";
import {
  AreaSeries,
  LineSeries,
  LineStyle,
  createChart,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import { z } from "zod";

import styles from "./chart.module.scss";
import {
  quickSelectWindowToMilliseconds,
  useChartQuickSelectWindow,
  useChartResolution,
} from "./use-chart-toolbar";
import { useLivePriceData } from "../../../hooks/use-live-price-data";
import { usePriceFormatter } from "../../../hooks/use-price-formatter";
import { Cluster } from "../../../services/pyth";

type Props = {
  symbol: string;
  feedId: string;
};

export const Chart = ({ symbol, feedId }: Props) => {
  const chartContainerRef = useChart(symbol, feedId);

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      className={styles.chart}
      ref={chartContainerRef}
    />
  );
};

const useChart = (symbol: string, feedId: string) => {
  const { chartContainerRef, chartRef } = useChartElem(symbol, feedId);
  useChartResize(chartContainerRef, chartRef);
  useChartColors(chartContainerRef, chartRef);
  return chartContainerRef;
};

const useChartElem = (symbol: string, feedId: string) => {
  const logger = useLogger();
  const [quickSelectWindow] = useChartQuickSelectWindow();
  const [resolution] = useChartResolution();
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartRefContents | undefined>(undefined);
  const isBackfilling = useRef(false);
  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  // Lightweight charts has [a
  // bug](https://github.com/tradingview/lightweight-charts/issues/1649) where
  // it does not properly return whitespace data back to us.  So we use this ref
  // to manually keep track of whitespace data so we can merge it at the
  // appropriate times.
  const whitespaceData = useRef<Set<WhitespaceData>>(new Set());

  const { current: livePriceData } = useLivePriceData(Cluster.Pythnet, feedId);
  const priceFormatter = usePriceFormatter(livePriceData?.exponent, {
    subscriptZeros: false,
  });

  const didResetVisibleRange = useRef(false);
  const didLoadInitialData = useRef(false);

  // Update the chart with the historical and live price data
  useEffect(() => {
    // Historical
    if (!chartRef.current || !didLoadInitialData.current || !livePriceData) {
      return;
    }

    const timestampMs = startOfResolution(
      new Date(Number(livePriceData.timestamp) * 1000),
      resolution,
    );

    const time = (timestampMs / 1000) as UTCTimestamp;

    if (livePriceData.status === PriceStatus.Trading) {
      // Update last data point
      const { price, confidence } = livePriceData.aggregate;

      const priceData: LineData = { time, value: price };
      const confidenceHighData: LineData = { time, value: price + confidence };
      const confidenceLowData: LineData = { time, value: price - confidence };

      const lastDataPoint = mergeData(chartRef.current.price.data(), [
        ...whitespaceData.current,
      ]).at(-1);

      if (lastDataPoint && lastDataPoint.time > priceData.time) {
        return;
      }

      chartRef.current.confidenceHigh.update(confidenceHighData);
      chartRef.current.confidenceLow.update(confidenceLowData);
      chartRef.current.price.update(priceData);
    } else {
      chartRef.current.price.update({ time });
      chartRef.current.confidenceHigh.update({ time });
      chartRef.current.confidenceLow.update({ time });
      whitespaceData.current.add({ time });
    }
  }, [livePriceData, resolution]);

  function maybeResetVisibleRange() {
    if (chartRef.current === undefined || didResetVisibleRange.current) {
      return;
    }
    const data = mergeData(chartRef.current.price.data(), [
      ...whitespaceData.current,
    ]);
    if (data.length > 0) {
      const first = data.at(0);
      const last = data.at(-1);
      if (!first || !last) {
        return;
      }
      chartRef.current.chart
        .timeScale()
        .setVisibleRange({ from: first.time, to: last.time });
      didResetVisibleRange.current = true;
    }
  }

  const fetchHistoricalData = useCallback(
    function fetchHistoricalData({
      from,
      to,
      resolution,
    }: {
      from: number;
      to: number;
      resolution: string;
    }) {
      if (isBackfilling.current) {
        return;
      }
      isBackfilling.current = true;
      const url = new URL("/historical-prices", globalThis.location.origin);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("from", from.toString());
      url.searchParams.set("to", to.toString());
      url.searchParams.set("resolution", resolution);
      url.searchParams.set("cluster", "pythnet");

      abortControllerRef.current = new AbortController();
      abortControllerRef.current.signal.addEventListener("abort", () => {
        isBackfilling.current = false;
      });

      fetch(url, { signal: abortControllerRef.current.signal })
        .then((rawData) => rawData.json())
        .then((jsonData) => {
          if (!chartRef.current) {
            return;
          }

          const data = historicalDataSchema.parse(jsonData);

          // Get the current historical price data
          // Note that .data() returns (WhitespaceData | LineData)[], hence the type cast.
          // We never populate the chart with WhitespaceData, so the type cast is safe.
          const currentHistoricalPriceData = chartRef.current.price.data();
          const currentHistoricalConfidenceHighData =
            chartRef.current.confidenceHigh.data();
          const currentHistoricalConfidenceLowData =
            chartRef.current.confidenceLow.data();

          const newHistoricalPriceData = data.map((d) => ({
            time: d.time,
            ...(d.status === PriceStatus.Trading && {
              value: d.price,
            }),
          }));
          const newHistoricalConfidenceHighData = data.map((d) => ({
            time: d.time,
            ...(d.status === PriceStatus.Trading && {
              value: d.price + d.confidence,
            }),
          }));
          const newHistoricalConfidenceLowData = data.map((d) => ({
            time: d.time,
            ...(d.status === PriceStatus.Trading && {
              value: d.price - d.confidence,
            }),
          }));

          // Combine the current and new historical price data
          const whitespaceDataAsArray = [...whitespaceData.current];
          const mergedPriceData = mergeData(
            mergeData(currentHistoricalPriceData, whitespaceDataAsArray),
            newHistoricalPriceData,
          );
          const mergedConfidenceHighData = mergeData(
            mergeData(
              currentHistoricalConfidenceHighData,
              whitespaceDataAsArray,
            ),
            newHistoricalConfidenceHighData,
          );
          const mergedConfidenceLowData = mergeData(
            mergeData(
              currentHistoricalConfidenceLowData,
              whitespaceDataAsArray,
            ),
            newHistoricalConfidenceLowData,
          );

          // Set the new historical price data and (maybe) reset the visible range
          chartRef.current.price.setData(mergedPriceData);
          chartRef.current.confidenceHigh.setData(mergedConfidenceHighData);
          chartRef.current.confidenceLow.setData(mergedConfidenceLowData);
          maybeResetVisibleRange();
          didLoadInitialData.current = true;

          for (const point of data) {
            if (point.status !== PriceStatus.Trading) {
              whitespaceData.current.add({ time: point.time });
            }
          }
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") {
            return;
          }
          logger.error("Error fetching historical prices", error);
        })
        .finally(() => {
          isBackfilling.current = false;
        });
    },
    [symbol, chartRef, logger],
  );

  useMountEffect(() => {
    const chartElem = chartContainerRef.current;
    if (chartElem === null) {
      throw new Error("Chart element was null on mount");
    }
    if (chartRef.current) {
      chartRef.current.chart.remove();
    }
    const chart = createChart(chartElem, {
      layout: {
        attributionLogo: false,
        background: { color: "transparent" },
      },
      grid: {
        horzLines: {
          color: "transparent",
        },
        vertLines: {
          color: "transparent",
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
      localization: {
        priceFormatter: priceFormatter.format,
      },
    });

    const confidenceHigh = chart.addSeries(AreaSeries, confidenceConfig);
    const confidenceLow = chart.addSeries(AreaSeries, confidenceConfig);
    const price = chart.addSeries(LineSeries, { priceFormat });

    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (!range || !didLoadInitialData.current) {
        return;
      }
      const { from, to } = range;
      const first = mergeData(chartRef.current?.price.data() ?? [], [
        ...whitespaceData.current,
      ]).at(0);

      if (!from || !to || !first) {
        return;
      }

      const fromMs = Number(from) * 1000;
      const toMs = Number(to) * 1000;
      const firstMs = Number(first.time) * 1000;

      const visibleRangeMs = toMs - fromMs;

      const remainingDataMs = fromMs - firstMs;
      const threshold = visibleRangeMs * 0.1;

      const newToMs = firstMs;
      const newFromMs = startOfResolution(
        new Date(newToMs - visibleRangeMs),
        resolution,
      );

      // When we're getting close to the earliest data, we need to backfill more
      if (remainingDataMs <= threshold) {
        fetchHistoricalData({
          from: newFromMs / 1000,
          to: newToMs / 1000,
          resolution,
        });
      }
    });

    chartRef.current = {
      chart,
      confidenceHigh,
      confidenceLow,
      price,
    };

    return () => {
      chart.remove();
    };
  });

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const now = new Date();
    const to = startOfResolution(now, resolution);
    const from = startOfResolution(
      new Date(
        now.getTime() - quickSelectWindowToMilliseconds(quickSelectWindow),
      ),
      resolution,
    );

    didResetVisibleRange.current = false;
    didLoadInitialData.current = false;
    chartRef.current.price.setData([]);
    chartRef.current.confidenceHigh.setData([]);
    chartRef.current.confidenceLow.setData([]);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort("Reset visible range");
      abortControllerRef.current = undefined;
    }

    fetchHistoricalData({
      from: from / 1000,
      to: to / 1000,
      resolution,
    });
  }, [quickSelectWindow, resolution, fetchHistoricalData]);

  // Update the chart's price formatter when the exponent becomes available
  useEffect(() => {
    if (chartRef.current && livePriceData?.exponent !== undefined) {
      chartRef.current.chart.applyOptions({
        localization: {
          priceFormatter: priceFormatter.format,
        },
      });
    }
  }, [livePriceData?.exponent, priceFormatter]);

  return { chartRef, chartContainerRef };
};

type ChartRefContents = {
  chart: IChartApi;
} & {
  confidenceHigh: ISeriesApi<"Area">;
  confidenceLow: ISeriesApi<"Area">;
  price: ISeriesApi<"Line">;
};

const historicalDataSchema = z.array(
  z
    .strictObject({
      timestamp: z.number(),
      price: z.number(),
      confidence: z.number(),
      status: z.nativeEnum(PriceStatus),
    })
    .transform((d) => ({
      time: Number(d.timestamp) as UTCTimestamp,
      price: d.price,
      confidence: d.confidence,
      status: d.status,
    })),
);
const priceFormat = {
  type: "price",
  precision: 5,
  minMove: 0.000_01,
} as const;

const confidenceConfig = {
  priceFormat,
  lineStyle: LineStyle.Dashed,
  lineWidth: 1,
} as const;

const useChartResize = (
  chartContainerRef: RefObject<HTMLDivElement | null>,
  chartRef: RefObject<ChartRefContents | undefined>,
) => {
  useResizeObserver(chartContainerRef.current, ({ contentRect }) => {
    const { chart } = chartRef.current ?? {};
    if (chart) {
      chart.applyOptions({ width: contentRect.width });
    }
  });
};

const useChartColors = (
  chartContainerRef: RefObject<HTMLDivElement | null>,
  chartRef: RefObject<ChartRefContents | undefined>,
) => {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (chartRef.current && chartContainerRef.current && resolvedTheme) {
      applyColors(chartRef.current, chartContainerRef.current, resolvedTheme);
    }
  }, [resolvedTheme, chartRef, chartContainerRef]);
};

const applyColors = (
  { chart, ...series }: ChartRefContents,
  container: HTMLDivElement,
  theme: string,
) => {
  const colors = getColors(container, theme);
  chart.applyOptions({
    grid: {
      horzLines: {
        visible: false,
      },
      vertLines: {
        visible: false,
      },
    },
    layout: {
      textColor: colors.muted,
    },
    timeScale: {
      borderColor: colors.border,
    },
    rightPriceScale: {
      borderColor: colors.border,
    },
  });
  series.confidenceHigh.applyOptions({
    lineColor: colors.chartConfidence,
    priceLineColor: colors.chartConfidence,
    topColor: colors.chartConfidence,
    bottomColor: colors.chartConfidence,
  });
  series.confidenceLow.applyOptions({
    lineColor: colors.chartConfidence,
    priceLineColor: colors.chartConfidence,
    topColor: colors.background,
    bottomColor: colors.background,
  });
  series.price.applyOptions({
    color: colors.chartPrimary,
  });
};

const getColors = (container: HTMLDivElement, resolvedTheme: string) => {
  const style = getComputedStyle(container);

  return {
    background: style.getPropertyValue(`--chart-background-${resolvedTheme}`),
    border: style.getPropertyValue(`--border-${resolvedTheme}`),
    muted: style.getPropertyValue(`--muted-${resolvedTheme}`),
    chartNeutral: style.getPropertyValue(
      `--chart-series-neutral-${resolvedTheme}`,
    ),
    chartPrimary: style.getPropertyValue(
      `--chart-series-primary-${resolvedTheme}`,
    ),
    chartConfidence: style.getPropertyValue(
      `--chart-series-muted-${resolvedTheme}`,
    ),
  };
};

/**
 * Merge (and sort) two arrays of line data, deduplicating by time
 */
export function mergeData(
  as: readonly (LineData | WhitespaceData)[],
  bs: (LineData | WhitespaceData)[],
) {
  const unique = new Map<Time, LineData | WhitespaceData>();

  for (const a of as) {
    unique.set(a.time, a);
  }
  for (const b of bs) {
    unique.set(b.time, b);
  }
  return [...unique.values()].sort((a, b) => {
    if (typeof a.time === "number" && typeof b.time === "number") {
      return a.time - b.time;
    } else {
      throw new TypeError(
        "Invariant failed: unexpected time type encountered, all time values must be of type UTCTimestamp",
      );
    }
  });
}

/**
 * Convert a date to the start of the given resolution, i.e. 1s = startOfSecond, 1m = startOfMinute, etc.
 */
export function startOfResolution(date: Date, resolution: string) {
  switch (resolution) {
    case "1s": {
      return startOfSecond(date).getTime();
    }
    case "1m":
    case "5m": {
      return startOfMinute(date).getTime();
    }
    case "1H": {
      return startOfHour(date).getTime();
    }
    case "1D": {
      return startOfDay(date).getTime();
    }
    default: {
      throw new Error(`Unknown resolution: ${resolution}`);
    }
  }
}
