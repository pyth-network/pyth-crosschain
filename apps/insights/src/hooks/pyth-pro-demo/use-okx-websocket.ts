"use client";

import { useCallback } from "react";

import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type { UseDataProviderSocketHookReturnType } from "../../types/pyth-pro-demo";
import {
  isAllowedCryptoSymbol,
  isAllowedSymbol,
} from "../../util/pyth-pro-demo";

type OKXBBOData = {
  arg: {
    channel: string;
    instId: "BTC-USDT" | "ETH-USDT";
  };
  data: {
    asks?: string[][]; // [price, size, liquidated_orders, number_of_orders] - only best ask
    bids?: string[][]; // [price, size, liquidated_orders, number_of_orders] - only best bid
    ts: string;
  }[];
};

export function useOKXWebSocket(): UseDataProviderSocketHookReturnType {
  /** context */
  const { addDataPoint, selectedSource } = usePythProAppStateContext();

  /** callbacks */
  const onOpen = useCallback<
    NonNullable<UseDataProviderSocketHookReturnType["onOpen"]>
  >(
    (socket) => {
      if (!isAllowedCryptoSymbol(selectedSource)) return;

      let instId = "";

      switch (selectedSource) {
        case "BTCUSDT": {
          instId = "BTC-USDT";
          break;
        }
        case "ETHUSDT": {
          instId = "ETH-USDT";
          break;
        }
        case "SOLUSDT": {
          {
            instId = "SOL-USDT";
            // No default
          }
          break;
        }
      }

      if (!instId) return;

      const subscribeMessage = {
        op: "subscribe",
        args: [
          {
            channel: "bbo-tbt",
            instId,
          },
        ],
      };
      socket.json(subscribeMessage);
    },
    [selectedSource],
  );
  const onMessage = useCallback<
    UseDataProviderSocketHookReturnType["onMessage"]
  >(
    (_, usdtToUsdRate, strData) => {
      if (!isAllowedSymbol(selectedSource)) return;

      try {
        const data = JSON.parse(strData) as Partial<OKXBBOData>;

        // Handle best bid/offer updates
        if (data.arg?.channel === "bbo-tbt" && data.data?.length) {
          const bboData = data as OKXBBOData;
          const tickData = bboData.data[0];

          if (tickData?.bids?.length && tickData.asks?.length) {
            // Get best bid and ask (directly from bbo-tbt channel)
            const bestBid = Number.parseFloat(tickData.bids[0]?.[0] ?? "");
            const bestAsk = Number.parseFloat(tickData.asks[0]?.[0] ?? "");
            const midPriceUSDT = (bestBid + bestAsk) / 2;

            // Convert USDT to USD using the fetched rate
            const midPriceUSD = midPriceUSDT * usdtToUsdRate;

            addDataPoint("okx", selectedSource, {
              price: midPriceUSD,
              timestamp: Date.now(),
            });
          }
        }
      } catch {
        // Ignore malformed WebSocket payloads
      }
    },
    [addDataPoint, selectedSource],
  );

  return { onMessage, onOpen };
}
