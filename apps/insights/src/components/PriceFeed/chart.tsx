"use client";

import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useResizeObserver } from "@react-hookz/web";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { LineSeries, LineStyle, createChart } from "lightweight-charts";
import { useTheme } from "next-themes";
import type { RefObject } from "react";
import { useEffect, useRef, useCallback } from "react";
import { z } from "zod";

import styles from "./chart.module.scss";
import { useLivePriceData } from "../../hooks/use-live-price-data";
import { usePriceFormatter } from "../../hooks/use-price-formatter";
import { Cluster } from "../../services/pyth";

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
  const { current } = useLivePriceData(Cluster.Pythnet, feedId);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartRefContents | undefined>(undefined);
  const earliestDateRef = useRef<bigint | undefined>(undefined);
  const isBackfilling = useRef(false);
  const priceFormatter = usePriceFormatter();

  const backfillData = useCallback(() => {
    if (!isBackfilling.current && earliestDateRef.current) {
      isBackfilling.current = true;
      const url = new URL("/historical-prices", globalThis.location.origin);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("until", earliestDateRef.current.toString());
      fetch(url)
        .then(async (data) => historicalDataSchema.parse(await data.json()))
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
              ({ timestamp, price, confidence }) => ({
                time: getLocalTimestamp(new Date(timestamp * 1000)),
                price,
                confidence,
              }),
            );
            chartRef.current.price.setData([
              ...convertedData.map(({ time, price }) => ({
                time,
                value: price,
              })),
              ...chartRef.current.price.data(),
            ]);
            chartRef.current.confidenceHigh.setData([
              ...convertedData.map(({ time, price, confidence }) => ({
                time,
                value: price + confidence,
              })),
              ...chartRef.current.confidenceHigh.data(),
            ]);
            chartRef.current.confidenceLow.setData([
              ...convertedData.map(({ time, price, confidence }) => ({
                time,
                value: price - confidence,
              })),
              ...chartRef.current.confidenceLow.data(),
            ]);
          }
          isBackfilling.current = false;
        })
        .catch((error: unknown) => {
          logger.error("Error fetching historical prices", error);
        });
    }
  }, [logger, symbol]);

  useEffect(() => {
    const chartElem = chartContainerRef.current;
    if (chartElem === null) {
      return;
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
  }, [backfillData, priceFormatter]);

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

const historicalDataSchema = z.array(
  z.strictObject({
    timestamp: z.number(),
    price: z.number(),
    confidence: z.number(),
  }),
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
