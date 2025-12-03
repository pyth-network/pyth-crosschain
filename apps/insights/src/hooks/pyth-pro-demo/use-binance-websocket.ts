"use client";

import { useCallback } from "react";

import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type { UseDataProviderSocketHookReturnType } from "../../types/pyth-pro-demo";
import { isAllowedCryptoSymbol } from "../../util/pyth-pro-demo";

type BinanceOrderBookData = {
  s: string; // symbol
  b: string; // best bid price
  B: string; // best bid quantity
  a: string; // best ask price
  A: string; // best ask quantity
};

export function useBinanceWebSocket(): UseDataProviderSocketHookReturnType {
  /** context */
  const { addDataPoint } = usePythProAppStateContext();

  /** callbacks */
  const onMessage = useCallback<
    UseDataProviderSocketHookReturnType["onMessage"]
  >(
    (_, usdtToUsdRate, socketData) => {
      try {
        const data = JSON.parse(socketData) as BinanceOrderBookData;
        if (isAllowedCryptoSymbol(data.s)) {
          // Calculate mid price from best bid and best ask
          const bestBid = Number.parseFloat(data.b);
          const bestAsk = Number.parseFloat(data.a);
          const midPriceUSDT = (bestBid + bestAsk) / 2;

          // Convert USDT to USD using the fetched rate
          const midPriceUSD = midPriceUSDT * usdtToUsdRate;

          addDataPoint("binance", data.s, {
            price: midPriceUSD,
            timestamp: Date.now(),
          });
        }
      } catch {
        // Ignore malformed WebSocket payloads
      }
    },
    [addDataPoint],
  );

  return { onMessage };
}
