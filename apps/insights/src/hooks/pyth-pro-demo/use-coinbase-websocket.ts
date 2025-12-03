"use client";

import type { UseWebSocketOpts } from "@pythnetwork/react-hooks/use-websocket";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined, isNumber } from "@pythnetwork/shared-lib/util";
import { useRef, useCallback } from "react";

import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import type { AllowedCryptoSymbolsType } from "../../schemas/pyth/pyth-pro-demo-schema";
import type { UseDataProviderSocketHookReturnType } from "../../types/pyth-pro-demo";
import { isAllowedCryptoSymbol } from "../../util/pyth-pro-demo";

type CoinbaseAdvancedTradeLevel2Message = {
  channel: string;
  client_id: string;
  timestamp: string;
  sequence_num: number;
  events: {
    type: string;
    product_id: "BTC-USD" | "ETH-USD" | "SOL-USD";
    updates?: {
      side: string; // "bid" or "offer"
      event_time: string;
      price_level: string;
      new_quantity: string;
    }[];
  }[];
};

type CoinbaseLevel2Snapshot = {
  channel: string;
  client_id: string;
  timestamp: string;
  sequence_num: number;
  events: {
    type: string;
    product_id: string;
    bids?: {
      price_level: string;
      new_quantity: string;
    }[];
    asks?: {
      price_level: string;
      new_quantity: string;
    }[];
  }[];
};

export function useCoinbaseWebSocket(): UseDataProviderSocketHookReturnType {
  /** context */
  const { addDataPoint, selectedSource } = usePythProAppStateContext();

  // Maintain local orderbook state for best bid/ask
  const orderbookRef = useRef<{
    bids: Map<string, string>; // price -> quantity
    asks: Map<string, string>; // price -> quantity
  }>({
    bids: new Map(),
    asks: new Map(),
  });

  /** callbacks */
  // Helper function to calculate mid-price from orderbook
  const calculateMidPrice = useCallback(() => {
    const bids = orderbookRef.current.bids;
    const asks = orderbookRef.current.asks;

    if (bids.size === 0 || asks.size === 0) {
      return;
    }

    const bestBidPrice = Math.max(...bids.keys().map(Number));
    // Get best ask (lowest price)
    const bestAskPrice = Math.min(...asks.keys().map(Number));

    if (isNumber(bestBidPrice) && Number.isFinite(bestAskPrice)) {
      return (bestBidPrice + bestAskPrice) / 2;
    }

    return;
  }, []);
  const onOpen = useCallback<NonNullable<UseWebSocketOpts["onOpen"]>>(
    (socket) => {
      let productId = "";
      switch (selectedSource) {
        case "BTCUSDT": {
          productId = "BTC-USD";
          break;
        }
        case "ETHUSDT": {
          productId = "ETH-USD";
          break;
        }
        case "SOLUSDT": {
          {
            productId = "SOL-USD";
            // No default
          }
          break;
        }
      }

      if (!productId) return;

      const subscribeMessage = {
        type: "subscribe",
        product_ids: [productId],
        channel: "level2",
      };
      socket.json(subscribeMessage);
    },
    [selectedSource],
  );
  const onMessage = useCallback<
    UseDataProviderSocketHookReturnType["onMessage"]
  >(
    (_, __, strData) => {
      const data = JSON.parse(strData) as Partial<{
        channel: string;
        events: CoinbaseAdvancedTradeLevel2Message["events"];
      }>;

      if (data.channel !== "l2_data" || !data.events) return;

      // Handle Advanced Trade level2 orderbook messages
      for (const event of data.events) {
        let symbol: Nullish<AllowedCryptoSymbolsType>;
        switch (event.product_id) {
          case "BTC-USD": {
            symbol = "BTCUSDT";
            break;
          }
          case "ETH-USD": {
            symbol = "ETHUSDT";
            break;
          }
          case "SOL-USD": {
            {
              symbol = "SOLUSDT";
              // No default
            }
            break;
          }
        }

        if (!isAllowedCryptoSymbol(symbol)) return;

        // Handle snapshot (initial orderbook state)
        if (event.type === "snapshot") {
          const snapshotEvent =
            event as unknown as CoinbaseLevel2Snapshot["events"][0];

          // Clear existing orderbook
          orderbookRef.current.bids.clear();
          orderbookRef.current.asks.clear();

          // Load bids
          if (snapshotEvent.bids?.length) {
            for (const bid of snapshotEvent.bids) {
              if (Number.parseFloat(bid.new_quantity) > 0) {
                orderbookRef.current.bids.set(
                  bid.price_level,
                  bid.new_quantity,
                );
              }
            }
          }

          // Load asks
          if (snapshotEvent.asks?.length) {
            for (const ask of snapshotEvent.asks) {
              if (Number.parseFloat(ask.new_quantity) > 0) {
                orderbookRef.current.asks.set(
                  ask.price_level,
                  ask.new_quantity,
                );
              }
            }
          }

          // Calculate and emit price after snapshot
          const midPrice = calculateMidPrice();
          if (!isNullOrUndefined(midPrice)) {
            addDataPoint("coinbase", symbol, {
              price: midPrice,
              timestamp: Date.now(),
            });
          }
        }
        // Handle updates (incremental changes)
        else if (event.type === "update") {
          const updateEvent = event;

          if (updateEvent.updates?.length) {
            for (const update of updateEvent.updates) {
              const quantity = Number.parseFloat(update.new_quantity);

              if (update.side === "bid") {
                if (quantity === 0) {
                  // Remove the price level
                  orderbookRef.current.bids.delete(update.price_level);
                } else {
                  // Update the price level
                  orderbookRef.current.bids.set(
                    update.price_level,
                    update.new_quantity,
                  );
                }
              } else if (update.side === "offer") {
                if (quantity === 0) {
                  // Remove the price level
                  orderbookRef.current.asks.delete(update.price_level);
                } else {
                  // Update the price level
                  orderbookRef.current.asks.set(
                    update.price_level,
                    update.new_quantity,
                  );
                }
              }
            }

            // Calculate and emit price after updates
            const midPrice = calculateMidPrice();
            if (!isNullOrUndefined(midPrice)) {
              addDataPoint("coinbase", symbol, {
                price: midPrice,
                timestamp: Date.now(),
              });
            }
          }
        }
      }
    },
    [addDataPoint, calculateMidPrice],
  );

  return { onMessage, onOpen };
}
