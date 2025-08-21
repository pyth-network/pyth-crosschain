"use client";

import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useResizeObserver, useMountEffect } from "@react-hookz/web";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { LineSeries, LineStyle, createChart } from "lightweight-charts";
import { useTheme } from "next-themes";
import type { RefObject } from "react";
import { useEffect, useRef, useCallback } from "react";
import { z } from "zod";

import styles from "./chart.module.scss";
import { useLivePriceData } from "../../../hooks/use-live-price-data";
import { usePriceFormatter } from "../../../hooks/use-price-formatter";
import { Cluster } from "../../../services/pyth";
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { INTERVAL_NAMES } from './chart-toolbar';

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
const historySchema = z.array(
  z.object({
    timestamp: z.number(),
    openPrice: z.number(),
    lowPrice: z.number(),
    closePrice: z.number(),
    highPrice: z.number(),
    avgPrice: z.number(),
    avgConfidence: z.number(),
    avgEmaPrice: z.number(),
    avgEmaConfidence: z.number(),
    startSlot: z.string(),
    endSlot: z.string(),
  }));
const fetchHistory = async ({ symbol, range, cluster, from, until }: { symbol: string, range: string, cluster: string, from: bigint, until: bigint }) => {
  const url = new URL("/api/pyth/get-history", globalThis.location.origin);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("range", range);
  url.searchParams.set("cluster", cluster);
  url.searchParams.set("from", from.toString());
  url.searchParams.set("until", until.toString());
  console.log("fetching history", {from: new Date(Number(from) * 1000), until: new Date(Number(until) * 1000)}, url.toString());
  return fetch(url).then(async (data) => historySchema.parse(await data.json()));
}

// const checkPriceData = (data: {time: UTCTimestamp}[]) => {
//   const chartData = [...data].sort((a, b) => a.time - b.time);
//   if(chartData.length < 2) {
//     return;
//   }
//   const firstElement = chartData.at(-2);
//   const secondElement = chartData.at(-1);
//   if(!firstElement || !secondElement ) {
//     return;
//   }
//   const detectedInterval = secondElement.time - firstElement.time
//   for(let i = 0; i < chartData.length - 1; i++) {
//     const currentElement = chartData[i];
//     const nextElement = chartData[i + 1];
//     if(!currentElement || !nextElement) {
//       return;
//     }
//     const interval = nextElement.time - currentElement.time
//     if(interval !== detectedInterval) {
//       console.warn("Price chartData is not consistent", {
//         current: currentElement,
//         next: nextElement,
//         detectedInterval,
//       });
//     }
//   }
//   return detectedInterval;
// }

const useChartElem = (symbol: string, feedId: string) => {
  const logger = useLogger();
  const { current } = useLivePriceData(Cluster.Pythnet, feedId);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartRefContents | undefined>(undefined);
  const earliestDateRef = useRef<bigint | undefined>(undefined);
  const isBackfilling = useRef(false);
  const priceFormatter = usePriceFormatter();
const [interval] = useQueryState(
    "interval",
    parseAsStringEnum(Object.values(INTERVAL_NAMES)).withDefault("Live"),
  );
  const backfillData = useCallback(() => {
    if (!isBackfilling.current && earliestDateRef.current) {
      isBackfilling.current = true;
      // seconds to date
      const range = interval === "Live" ? "1H" : interval;
      console.log("backfilling", new Date(Number(earliestDateRef.current) * 1000), {from: earliestDateRef.current - 100n, until: earliestDateRef.current});
      fetchHistory({ symbol, range, cluster: "pythnet", from: earliestDateRef.current - 100n, until: earliestDateRef.current })
        .then((data) => {
          const firstPoint = data[0];
          if (firstPoint) {
            earliestDateRef.current = BigInt(firstPoint.timestamp);
          }
          if (
            chartRef.current &&
            chartRef.current.resolution === Resolution.Tick
          ) {
            const convertedData = data.map(
              ({ timestamp, avgPrice, avgConfidence }) => ({
                time: getLocalTimestamp(new Date(timestamp*1000)),
                price: avgPrice,
                confidence: avgConfidence,
              }),
            );
            console.log("convertedData",   
              {current: chartRef?.current?.price.data().map(({ time, value }) => ({
                time: new Date(time*1000),
                value,
              })),
              converted: convertedData.map(({ time, price }) => ({
                time: new Date(time*1000),
                value: price,
              }))
            });
            const newPriceData = [...convertedData.map(({ time, price }) => ({
                time,
                value: price,
              })),
              ...chartRef.current.price.data(),]
            const newConfidenceHighData = [...convertedData.map(({ time, price, confidence }) => ({
                time,
                value: price + confidence,
              })),
              ...chartRef.current.confidenceHigh.data(),]
            const newConfidenceLowData = [...convertedData.map(({ time, price, confidence }) => ({
              time,
              value: price - confidence,
            })), ...chartRef.current.confidenceLow.data(),]
            checkPriceData(convertedData.map(({ time, price }) => ({
                time,
                value: price,
              })));
            console.log(newPriceData)
            chartRef.current.price.setData(newPriceData);
            chartRef.current.confidenceHigh.setData(newConfidenceHighData);
            chartRef.current.confidenceLow.setData(newConfidenceLowData);
          }
          isBackfilling.current = false;
        })
        .catch((error: unknown) => {
          logger.error("Error fetching historical prices", error);
        });
    }
  }, [logger, symbol]);

  useMountEffect(() => {
    const chartElem = chartContainerRef.current;
    if (chartElem === null) {
      throw new Error("Chart element was null on mount");
    } else {
      const chart = createChart(chartElem, {
        layout: {
          attributionLogo: false,
          background: { color: "transparent" },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
        },
        localization: {
          priceFormatter: priceFormatter.format,
        },
      });

      const price = chart.addSeries(LineSeries, { priceFormat });

      chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (
          range && // if (range.to - range.from > 1000) {
          //   console.log("DECREASE RESOLUTION");
          // } else if (range.to - range.from < 100) {
          //   console.log("INCREASE RESOLUTION");
          // } else if (range.from < 10) {
          range.from < 10
        ) {
          backfillData();
        }
      });

      chartRef.current = {
        resolution: Resolution.Tick,
        chart,
        confidenceHigh: chart.addSeries(LineSeries, confidenceConfig),
        confidenceLow: chart.addSeries(LineSeries, confidenceConfig),
        price,
      };
      return () => {
        chart.remove();
      };
    }
  });

  useEffect(() => {
    if (current && chartRef.current) {
      earliestDateRef.current ??= current.timestamp;
      const { price, confidence } = current.aggregate;
      const time = getLocalTimestamp(
        new Date(Number(current.timestamp * 1000n)),
      );
      if (chartRef.current.resolution === Resolution.Tick) {
        chartRef.current.price.update({ time, value: price });
        chartRef.current.confidenceHigh.update({
          time,
          value: price + confidence,
        });
        chartRef.current.confidenceLow.update({
          time,
          value: price - confidence,
        });
      }
    }
  }, [current]);

  return { chartRef, chartContainerRef };
};

enum Resolution {
  Tick,
  Minute,
  Hour,
  Day,
}

type ChartRefContents = {
  chart: IChartApi;
} & (
  | {
      resolution: Resolution.Tick;
      confidenceHigh: ISeriesApi<"Line">;
      confidenceLow: ISeriesApi<"Line">;
      price: ISeriesApi<"Line">;
    }
  | {
      resolution: Exclude<Resolution, Resolution.Tick>;
      series: ISeriesApi<"Candlestick">;
    }
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
        color: colors.border,
      },
      vertLines: {
        color: colors.border,
      },
    },
    layout: {
      textColor: colors.muted,
    },
    timeScale: {
      borderColor: colors.muted,
    },
    rightPriceScale: {
      borderColor: colors.muted,
    },
  });
  if (series.resolution === Resolution.Tick) {
    series.confidenceHigh.applyOptions({
      color: colors.chartNeutral,
    });
    series.confidenceLow.applyOptions({
      color: colors.chartNeutral,
    });
    series.price.applyOptions({
      color: colors.chartPrimary,
    });
  }
};

const getColors = (container: HTMLDivElement, resolvedTheme: string) => {
  const style = getComputedStyle(container);

  return {
    border: style.getPropertyValue(`--border-${resolvedTheme}`),
    muted: style.getPropertyValue(`--muted-${resolvedTheme}`),
    chartNeutral: style.getPropertyValue(
      `--chart-series-neutral-${resolvedTheme}`,
    ),
    chartPrimary: style.getPropertyValue(
      `--chart-series-primary-${resolvedTheme}`,
    ),
  };
};

const getLocalTimestamp = (date: Date): UTCTimestamp =>
  (Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  ) / 1000) as UTCTimestamp;
