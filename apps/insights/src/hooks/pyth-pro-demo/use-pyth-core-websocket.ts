"use client";

import type { UseWebSocketOpts } from "@pythnetwork/react-hooks/use-websocket";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { useCallback } from "react";

import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type { AllAllowedSymbols } from "../../schemas/pyth/pyth-pro-demo-schema";
import type { UseDataProviderSocketHookReturnType } from "../../types/pyth-pro-demo";
import { isAllowedSymbol } from "../../util/pyth-pro-demo";

type PythPriceUpdateMessage = {
  type: string;
  price_feed: {
    id: string;
    price?: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    };
    ema_price: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    };
  };
};

const SYMBOL_TO_PRICE_FEED_MAP = new Map<Nullish<AllAllowedSymbols>, string>([
  [undefined, ""],
  // eslint-disable-next-line unicorn/no-null
  [null, ""],
  [
    "BTCUSDT",
    "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ],
  [
    "ETHUSDT",
    "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  ],
  [
    "SOLUSDT",
    "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  ],
  [
    "EURUSD",
    "a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
  ],
  ["AAPL", "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688"],
  ["TSLA", "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1"],
  ["NVDA", "b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593"],
  ["SPY", "19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5"],
  [
    "ESZ2025",
    "2f007d2339327f9be181b61354ca0ec579d8c4ed37d575bb66921109ebffc2c9",
  ],
  ["no_symbol_selected", ""],
]);

const PRICE_FEED_TO_SYMBOL_MAP = new Map(
  SYMBOL_TO_PRICE_FEED_MAP.entries().map(([symbol, feedId]) => [
    feedId,
    symbol,
  ]),
);

export function usePythCoreWebSocket(): UseDataProviderSocketHookReturnType {
  /** context */
  const { addDataPoint, selectedSource } = usePythProAppStateContext();

  /** callbacks */
  const onMessage = useCallback<
    UseDataProviderSocketHookReturnType["onMessage"]
  >(
    (_, __, strData) => {
      const data = JSON.parse(strData) as Partial<
        PythPriceUpdateMessage & { result: string }
      >;

      // Handle subscription confirmation
      if (data.result === "success") {
        return;
      }

      // Handle price updates
      if (data.type === "price_update" && data.price_feed) {
        const priceUpdateData = data as PythPriceUpdateMessage;
        const priceFeed = priceUpdateData.price_feed;

        const symbol = PRICE_FEED_TO_SYMBOL_MAP.get(priceFeed.id);

        // Check if this is the BTC/USD feed
        if (isAllowedSymbol(symbol) && !isNullOrUndefined(priceFeed.price)) {
          // Convert price with exponent: price * 10^expo
          const price =
            Number.parseFloat(priceFeed.price.price) *
            Math.pow(10, priceFeed.price.expo);

          addDataPoint("pyth", symbol, {
            price: price,
            timestamp: Date.now(),
          });
        }
      }
    },
    [addDataPoint],
  );
  const onOpen = useCallback<NonNullable<UseWebSocketOpts["onOpen"]>>(
    (socket) => {
      const feedId = SYMBOL_TO_PRICE_FEED_MAP.get(selectedSource);

      if (!feedId) return;

      const subscribeMessage = {
        type: "subscribe",
        ids: [feedId],
      };
      socket.json(subscribeMessage);
    },
    [selectedSource],
  );

  return { onMessage, onOpen };
}
