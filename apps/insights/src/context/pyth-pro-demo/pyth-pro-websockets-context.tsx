"use client";

import type { Nullish } from "@pythnetwork/shared-lib/types";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo } from "react";

import { usePythProApiTokensContext } from "./pyth-pro-api-tokens-context";
import { usePythProAppStateContext } from "./pyth-pro-app-state";
import { useDataStream, useHttpDataStream } from "../../hooks/pyth-pro-demo";
import type { AllDataSourcesType } from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  isAllowedCryptoSymbol,
  isAllowedSymbol,
  isHistoricalSymbol,
} from "../../util/pyth-pro-demo";

type WebSocketsContextVal = {
  statuses: Partial<
    Record<AllDataSourcesType, ReturnType<typeof useDataStream>["status"]>
  >;
};

const context = createContext<Nullish<WebSocketsContextVal>>(undefined);

export function WebSocketsProvider({ children }: PropsWithChildren) {
  /** context */
  const { selectedSource } = usePythProAppStateContext();
  const { tokens } = usePythProApiTokensContext();

  /** local variables */
  const isGoodSymbol = isAllowedSymbol(selectedSource);
  const isCryptoSymbol = isAllowedCryptoSymbol(selectedSource);

  /** hooks */
  const { status: binance } = useDataStream({
    dataSource: "binance",
    enabled: isCryptoSymbol,
    symbol: isAllowedCryptoSymbol(selectedSource) ? selectedSource : undefined,
  });

  const { status: bybit } = useDataStream({
    dataSource: "bybit",
    enabled: isCryptoSymbol,
    symbol: isAllowedCryptoSymbol(selectedSource) ? selectedSource : undefined,
  });

  const { status: coinbase } = useDataStream({
    dataSource: "coinbase",
    enabled: isCryptoSymbol,
    symbol: isAllowedCryptoSymbol(selectedSource) ? selectedSource : undefined,
  });

  const { status: okx } = useDataStream({
    dataSource: "okx",
    enabled: isCryptoSymbol,
    symbol: isAllowedCryptoSymbol(selectedSource) ? selectedSource : undefined,
  });

  const { status: pyth } = useDataStream({
    dataSource: "pyth",
    enabled: isGoodSymbol,
    symbol: selectedSource,
  });

  const { status: pyth_pro } = useDataStream({
    dataSource: "pyth_pro",
    enabled: isGoodSymbol && Boolean(tokens.pyth_pro),
    symbol: selectedSource,
  });

  // "Fake" websocket-like contract for easier integration
  const { status: pyth_pro_historical } = useHttpDataStream({
    dataSource: "pyth_pro",
    enabled: isGoodSymbol && isHistoricalSymbol(selectedSource),
    symbol: selectedSource,
  });

  const { status: nasdaq_historical } = useHttpDataStream({
    dataSource: "NASDAQ",
    enabled: isGoodSymbol && isHistoricalSymbol(selectedSource),
    symbol: selectedSource,
  });

  /** provider val */
  const providerVal = useMemo<WebSocketsContextVal>(
    () => ({
      statuses: {
        binance,
        bybit,
        coinbase,
        okx,
        NASDAQ: nasdaq_historical,
        pyth,
        pyth_pro: isHistoricalSymbol(selectedSource)
          ? pyth_pro_historical
          : pyth_pro,
        yahoo: "connected",
      },
    }),
    [
      binance,
      bybit,
      coinbase,
      nasdaq_historical,
      okx,
      pyth,
      pyth_pro,
      pyth_pro_historical,
      selectedSource,
    ],
  );

  return <context.Provider value={providerVal}>{children}</context.Provider>;
}

export function useWebSocketsContext() {
  const ctx = useContext(context);

  if (!ctx) {
    throw new Error(
      "unable to useWebSocketsContext() because no <WebSocketsProvider /> was found in the parent tree",
    );
  }

  return ctx;
}
