/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { useCallback, useEffect, useMemo, useRef } from "react";

import { useFetchUsdToUsdRate } from "./use-fetch-usdt-stuff";
import { useSelectedSourceStats } from "./use-selected-source-stats";
import type { UseWebSocketOpts } from "./use-websocket";
import { useWebsockets } from "./use-websocket";

/**
 * given the user's currently selected source,
 * opens websocket connections to get the data
 * and starts piping this data into the UIState.
 * Any previously-opened connections are closed
 */
export function useSelectedSourceStream() {
  /** store */
  const { selectedSource } = useSelectedSourceStats();

  /** refs */
  const coinbaseOrderbookRef = useRef<{
    bids: Map<string, string>; // price -> quantity
    asks: Map<string, string>; // price -> quantity
  }>({
    bids: new Map(),
    asks: new Map(),
  });

  /** queries */
  const { usdtToUsdRate } = useFetchUsdToUsdRate();

  /** callbacks */
  const calculateCoinbaseMidPrice = useCallback(() => {
    const bids = coinbaseOrderbookRef.current.bids;
    const asks = coinbaseOrderbookRef.current.asks;

    if (bids.size === 0 || asks.size === 0) {
      return;
    }

    // Get best bid (highest price)
    const bestBidPrice = Math.max(...[...bids.keys()].map(Number));
    // Get best ask (lowest price)
    const bestAskPrice = Math.min(...[...asks.keys()].map(Number));

    if (Number.isFinite(bestBidPrice) && Number.isFinite(bestAskPrice)) {
      const midPrice = (bestBidPrice + bestAskPrice) / 2;
      return midPrice;
    }

    return;
  }, []);

  /** memos */
  const websocketConnectionOpts = useMemo<UseWebSocketOpts[]>(() => {
    if (selectedSource.crypto) {
      return [
        {
          id: "coinbase",
          onConnected: (_, s) => {
            const subscribeMessage = {
              type: "subscribe",
              product_ids: [`${selectedSource.id}-USD`],
              channel: "level2",
            };

            s.json(subscribeMessage);
          },
          onMessage: (msg) => {
            try {
              const data = JSON.parse(String(msg));

              // Handle Advanced Trade level2 orderbook messages
              if (data.channel === "l2_data" && data.events) {
                for (const event of data.events) {
                  // console.log('Coinbase: Processing event type:', event.type, 'for product:', event.product_id);
                  if (event.product_id === `${selectedSource.id}-USD`) {
                    // Handle snapshot (initial orderbook state)
                    if (event.type === "snapshot") {
                      const snapshotEvent = event as
                        | CoinbaseLevel2Snapshot["events"][0]
                        | null
                        | undefined;

                      // Clear existing orderbook
                      coinbaseOrderbookRef.current.bids.clear();
                      coinbaseOrderbookRef.current.asks.clear();

                      // Load bids
                      if (snapshotEvent?.bids?.length) {
                        for (const bid of snapshotEvent.bids) {
                          if (Number.parseFloat(bid.new_quantity) > 0) {
                            coinbaseOrderbookRef.current.bids.set(
                              bid.price_level,
                              bid.new_quantity,
                            );
                          }
                        }
                      }

                      // Load asks
                      if (snapshotEvent?.asks?.length) {
                        for (const ask of snapshotEvent.asks) {
                          if (Number.parseFloat(ask.new_quantity) > 0) {
                            coinbaseOrderbookRef.current.asks.set(
                              ask.price_level,
                              ask.new_quantity,
                            );
                          }
                        }
                      }

                      //console.log('Coinbase: Loaded orderbook snapshot');

                      // Calculate and emit price after snapshot
                      const midPrice = calculateCoinbaseMidPrice();
                      if (typeof midPrice === "number") {
                        // TODO: emit into UI state
                        // onPriceUpdate({
                        //   price: midPrice,
                        //   timestamp: Date.now(),
                        //   source: "coinbase",
                        // });
                      }
                    }
                    // Handle updates (incremental changes)
                    else if (event.type === "update") {
                      const updateEvent = event as
                        | CoinbaseAdvancedTradeLevel2Message["events"][0]
                        | null
                        | undefined;

                      if (updateEvent?.updates.length) {
                        for (const update of updateEvent.updates) {
                          const quantity = Number.parseFloat(
                            update.new_quantity,
                          );

                          if (update.side === "bid") {
                            if (quantity === 0) {
                              // Remove the price level
                              coinbaseOrderbookRef.current.bids.delete(
                                update.price_level,
                              );
                            } else {
                              // Update the price level
                              coinbaseOrderbookRef.current.bids.set(
                                update.price_level,
                                update.new_quantity,
                              );
                            }
                          } else if (update.side === "offer") {
                            if (quantity === 0) {
                              // Remove the price level
                              coinbaseOrderbookRef.current.asks.delete(
                                update.price_level,
                              );
                            } else {
                              // Update the price level
                              coinbaseOrderbookRef.current.asks.set(
                                update.price_level,
                                update.new_quantity,
                              );
                            }
                          }
                        }

                        // Calculate and emit price after updates
                        const midPrice = calculateCoinbaseMidPrice();
                        if (typeof midPrice === "number") {
                          // TODO: emit into ui state
                          // onPriceUpdate({
                          //   price: midPrice,
                          //   timestamp: Date.now(),
                          //   source: "coinbase",
                          // });
                        }
                      }
                    }
                  }
                }
              }
              // Handle subscription confirmations
              else if (data.type === "subscriptions") {
                console.log("Coinbase: Subscription confirmed:", data);
              }
              // Handle errors
              else if (data.type === "error") {
                console.error("Coinbase: Subscription error:", data);
              }
            } catch (error) {
              console.error("Error parsing Coinbase message:", error);
            }
          },
          url: "wss://advanced-trade-ws.coinbase.com",
        },
        {
          id: "binance",
          onMessage: (msg) => {
            try {
              const data = JSON.parse(String(msg)) as BinanceOrderBookData;
              if (data.s === `${selectedSource.id}USDT`) {
                // Calculate mid price from best bid and best ask
                const bestBid = Number.parseFloat(data.b);
                const bestAsk = Number.parseFloat(data.a);
                const midPriceUSDT = (bestBid + bestAsk) / 2;

                // Convert USDT to USD using the fetched rate
                const midPriceUSD = midPriceUSDT * usdtToUsdRate;

                // TODO: need to emit this into ui state
                // onPriceUpdate({
                //   price: midPriceUSD,
                //   timestamp: Date.now(),
                //   source: "binance",
                // });
              }
            } catch (error) {
              console.error("Error parsing Binance message:", error);
            }
          },
          url: `wss://stream.binance.com:9443/ws/${selectedSource.id.toLowerCase()}usdt@bookTicker`,
        },
        {
          id: "bybit",
          onConnected: (_, s) => {
            const subscribeMessage = {
              op: "subscribe",
              args: [`orderbook.1.${selectedSource.id}USDT`],
            };
            s.json(subscribeMessage);
          },
          onMessage: (msg) => {
            try {
              const data = JSON.parse(String(msg));
              // console.log('Bybit: Received message:', data);

              // Handle orderbook updates
              if (
                (data.topic === `orderbook.1.${selectedSource.id}USDT` &&
                  data.type === "snapshot") ||
                data.type === "delta"
              ) {
                const orderBookData = data as BybitOrderBookData;
                const bookData = orderBookData.data;

                if (bookData.b.length > 0 && bookData.a.length > 0) {
                  // Get best bid and ask (first elements in the arrays)
                  const bestBid = Number.parseFloat(bookData.b[0]?.[0] ?? "");
                  const bestAsk = Number.parseFloat(bookData.a[0]?.[0] ?? "");
                  const midPriceUSDT = (bestBid + bestAsk) / 2;

                  const midPriceUSD = midPriceUSDT * usdtToUsdRate;

                  // TODO: Need to emit this event into the UI state
                  // onPriceUpdate({
                  //   price: midPriceUSD,
                  //   timestamp: Date.now(),
                  //   source: "bybit",
                  // });
                }
              }
              // Handle subscription confirmations
              else if (data.success === true) {
                console.info("Bybit: Subscription confirmed:", data);
              }
              // Handle errors
              else if (data.success === false) {
                console.error("Bybit: Subscription error:", data);
              }
            } catch (error) {
              console.error("Error parsing Bybit message:", error);
            }
          },
          url: "wss://stream.bybit.com/v5/public/spot",
        },
      ];
    }
    return [];
  }, [
    calculateCoinbaseMidPrice,
    selectedSource.crypto,
    selectedSource.id,
    usdtToUsdRate,
  ]);

  /** hooks */
  const sockets = useWebsockets(websocketConnectionOpts);

  /** effects */
  useEffect(() => {
    return () => {
      sockets.disconnectAll();
    };
  }, [sockets]);
}

type BybitOrderBookData = {
  topic: string;
  type: string;
  ts: number;
  data: {
    s: string; // symbol
    b: [string, string][]; // bids [price, size]
    a: [string, string][]; // asks [price, size]
    u: number; // update id
    seq: number; // sequence number
  };
};

type BinanceOrderBookData = {
  s: string; // symbol
  b: string; // best bid price
  B: string; // best bid quantity
  a: string; // best ask price
  A: string; // best ask quantity
};

type CoinbaseAdvancedTradeLevel2Message = {
  channel: string;
  client_id: string;
  timestamp: string;
  sequence_num: number;
  events: {
    type: string;
    product_id: string;
    updates: {
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
