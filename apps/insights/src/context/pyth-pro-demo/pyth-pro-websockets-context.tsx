"use client";

import type { Nullish } from "@pythnetwork/shared-lib/types";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo } from "react";

import { usePythProApiTokensContext } from "./pyth-pro-api-tokens-context";
import { usePythProAppStateContext } from "./pyth-pro-app-state";
import { useDataStream } from "../../hooks/pyth-pro-demo";
import type { AllDataSourcesType } from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  isAllowedCryptoSymbol,
  isAllowedEquitySymbol,
  isAllowedForexSymbol,
  isAllowedSymbol,
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
  const isEquity = isAllowedEquitySymbol(selectedSource);
  const isForex = isAllowedForexSymbol(selectedSource);
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

  const { status: prime_api } = useDataStream({
    dataSource: "prime_api",
    enabled: isForex && Boolean(tokens.prime_api),
    symbol: selectedSource,
  });

  const { status: infoway_io } = useDataStream({
    dataSource: "infoway_io",
    enabled: isEquity && Boolean(tokens.infoway_io),
    symbol: selectedSource,
  });

  const { status: twelve_data } = useDataStream({
    dataSource: "twelve_data",
    enabled: (isForex || isEquity) && Boolean(tokens.twelve_data),
    symbol: selectedSource,
  });

  /** provider val */
  const providerVal = useMemo<WebSocketsContextVal>(
    () => ({
      statuses: {
        binance,
        bybit,
        coinbase,
        infoway_io,
        okx,
        prime_api,
        pyth,
        pyth_pro,
        twelve_data,
        yahoo: "connected",
      },
    }),
    [
      binance,
      bybit,
      coinbase,
      infoway_io,
      okx,
      prime_api,
      pyth,
      pyth_pro,
      twelve_data,
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
