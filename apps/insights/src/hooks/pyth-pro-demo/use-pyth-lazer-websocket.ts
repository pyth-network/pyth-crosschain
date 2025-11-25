"use client";

import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { useCallback } from "react";

import { usePythProStoreStateForWebsocket } from "./use-pyth-pro-store-state-for-websocket";
import type { AllAllowedSymbols } from "../../schemas/pyth/pyth-pro-demo-schema";
import type { UseDataProviderSocketHookReturnType } from "../../types/pyth-pro-demo";
import { isAllowedSymbol } from "../../util/pyth-pro-demo";

type PythLazerStreamUpdate = {
  type: string;
  subscriptionId: number;
  parsed?: {
    timestampUs: string;
    priceFeeds?: {
      exponent: number;
      priceFeedId: number;
      price?: Nullish<string>;
    }[];
  };
};

const SYMBOL_TO_PRICE_FEED_MAP = new Map<
  Nullish<AllAllowedSymbols>,
  Nullish<number>
>([
  [undefined, undefined],
  // eslint-disable-next-line unicorn/no-null
  [null, null],
  ["BTCUSDT", 1],
  ["ETHUSDT", 2],
  ["SOLUSDT", 6],
  ["EURUSD", 327],
  ["AAPL", 922],
  ["TSLA", 1435],
  ["NVDA", 1314],
  ["SPY", 1398],
  ["ESZ2025", 2284],
  ["no_symbol_selected", Number.MIN_SAFE_INTEGER],
  // ["ESH2026", 2282],
  // ["US10Y", 1527],
]);

const PRICE_FEED_TO_SYMBOL_MAP = new Map(
  SYMBOL_TO_PRICE_FEED_MAP.entries().map(([symbol, feedId]) => [
    feedId,
    symbol,
  ]),
);

const SYMBOL_TO_CHANNEL_MAP = new Map<
  Nullish<AllAllowedSymbols>,
  Nullish<"real_time" | "fixed_rate@200ms">
>([
  [undefined, undefined],
  // eslint-disable-next-line unicorn/no-null
  [null, null],
  ["BTCUSDT", "real_time"],
  ["ETHUSDT", "real_time"],
  ["SOLUSDT", "real_time"],
  ["EURUSD", "fixed_rate@200ms"],
  ["AAPL", "real_time"],
  ["TSLA", "real_time"],
  ["NVDA", "real_time"],
  ["SPY", "fixed_rate@200ms"],
  ["ESZ2025", "real_time"],
  ["no_symbol_selected", "real_time"],
  // ["ESH2026", "real_time"],
  // ["US10Y", "fixed_rate@200ms"],
]);

export function usePythLazerWebSocket(): UseDataProviderSocketHookReturnType {
  /** store */
  const { addDataPoint, selectedSource } = usePythProStoreStateForWebsocket();

  /** callbacks */
  const onOpen = useCallback<
    NonNullable<UseDataProviderSocketHookReturnType["onOpen"]>
  >(
    (socket) => {
      if (!isAllowedSymbol(selectedSource)) return;
      const feedId = SYMBOL_TO_PRICE_FEED_MAP.get(selectedSource);

      if (isNullOrUndefined(feedId)) return;

      // Subscribe to BTC price feed
      const subscribeMessage = {
        subscriptionId: 1,
        type: "subscribe",
        priceFeedIds: [feedId],
        properties: ["exponent", "price"],
        chains: [],
        channel: SYMBOL_TO_CHANNEL_MAP.get(selectedSource),
      };
      socket.json(subscribeMessage);
    },
    [selectedSource],
  );
  const onMessage = useCallback<
    UseDataProviderSocketHookReturnType["onMessage"]
  >(
    (_, __, strData) => {
      const data = JSON.parse(strData) as Partial<
        PythLazerStreamUpdate & { type: string }
      >;

      // Handle stream updates
      if (data.type === "streamUpdated" && data.subscriptionId === 1) {
        const updateData = data as PythLazerStreamUpdate;

        if (updateData.parsed?.priceFeeds?.length) {
          const priceFeed = updateData.parsed.priceFeeds[0];

          const symbol = PRICE_FEED_TO_SYMBOL_MAP.get(priceFeed?.priceFeedId);

          if (!isNullOrUndefined(priceFeed) && isAllowedSymbol(symbol)) {
            const { exponent, price } = priceFeed;
            if (isNullOrUndefined(price)) return;

            // pyth_lazer price has 8 decimal places precision, convert to dollars
            const priceRaw = Number.parseFloat(price);

            addDataPoint("pyth_pro", symbol, {
              price: priceRaw * Math.pow(10, exponent),
              timestamp: Date.now(),
            });
          }
        }
      }
    },
    [addDataPoint],
  );

  return { onMessage, onOpen };
}
