"use client";

import type { UseWebSocketOpts } from "@pythnetwork/react-hooks/use-websocket";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { useCallback } from "react";

import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type { AllowedCryptoSymbolsType } from "../../schemas/pyth/pyth-pro-demo-schema";
import type { UseDataProviderSocketHookReturnType } from "../../types/pyth-pro-demo";
import { isAllowedSymbol } from "../../util/pyth-pro-demo";

type BybitOrderBookData = {
  topic: string;
  type: string;
  ts: number;
  data: {
    s: string; // symbol
    b?: [string, string][]; // bids [price, size]
    a?: [string, string][]; // asks [price, size]
    u: number; // update id
    seq: number; // sequence number
  };
};

export function useBybitWebSocket(): UseDataProviderSocketHookReturnType {
  /** context */
  const { addDataPoint, selectedSource } = usePythProAppStateContext();

  /** callbacks */
  const onOpen = useCallback<NonNullable<UseWebSocketOpts["onOpen"]>>(
    (socket) => {
      if (!isAllowedSymbol(selectedSource)) return;

      const subscribeMessage = {
        op: "subscribe",
        args: [`orderbook.1.${selectedSource}`],
      };
      socket.json(subscribeMessage);
    },
    [selectedSource],
  );
  const onMessage = useCallback<
    UseDataProviderSocketHookReturnType["onMessage"]
  >(
    (_, usdtToUsdRate, socketData) => {
      const data = JSON.parse(socketData) as Partial<
        BybitOrderBookData & {
          topic: `orderbook.1.${AllowedCryptoSymbolsType}`;
          type: string;
        }
      >;

      // Handle orderbook updates
      if (data.type === "snapshot" || data.type === "delta") {
        const symbol = data.topic?.split(".").pop();
        if (!symbol) return;

        const orderBookData = data as BybitOrderBookData;
        const bookData = orderBookData.data;

        if (bookData.b?.length && bookData.a?.length) {
          // Get best bid and ask (first elements in the arrays)
          const bestBid = Number.parseFloat(bookData.b[0]?.[0] ?? "");
          const bestAsk = Number.parseFloat(bookData.a[0]?.[0] ?? "");
          const midPriceUSDT = (bestBid + bestAsk) / 2;

          // Convert USDT to USD using the fetched rate
          if (!isNullOrUndefined(usdtToUsdRate)) {
            const midPriceUSD = midPriceUSDT * usdtToUsdRate;

            addDataPoint("bybit", symbol as AllowedCryptoSymbolsType, {
              price: midPriceUSD,
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
