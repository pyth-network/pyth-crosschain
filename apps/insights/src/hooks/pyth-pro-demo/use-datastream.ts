"use client";

import type { UseWebSocketOpts } from "@pythnetwork/react-hooks/use-websocket";
import { useWebSocket } from "@pythnetwork/react-hooks/use-websocket";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { useCallback } from "react";

import { useBinanceWebSocket } from "./use-binance-websocket";
import { useBybitWebSocket } from "./use-bybit-websocket";
import { useCoinbaseWebSocket } from "./use-coinbase-websocket";
import { useFetchUsdtToUsdRate } from "./use-fetch-usdt-to-rate";
import { useInfowayWebSocket } from "./use-infoway-websocket";
import { useOKXWebSocket } from "./use-okx-websocket";
import { usePrimeApiWebSocket } from "./use-prime-api-websocket";
import { usePythCoreWebSocket } from "./use-pyth-core-websocket";
import { usePythLazerWebSocket } from "./use-pyth-lazer-websocket";
import { useTwelveWebSocket } from "./use-twelve-websocket";
import { usePythProApiTokensContext } from "../../context/pyth-pro-demo";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  ApiTokensState,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { isAllowedForexSymbol } from "../../util/pyth-pro-demo";

function getUrlForSymbolAndDataSource(
  apiTokens: ApiTokensState,
  dataSource: AllDataSourcesType,
  symbol: Nullish<AllAllowedSymbols>,
): Nullish<string> {
  if (!symbol) return;

  switch (dataSource) {
    case "infoway_io": {
      return `wss://data.infoway.io/ws?business=${
        isAllowedForexSymbol(symbol) ? "common" : "stock"
      }&apikey=${apiTokens.infoway_io ?? ""}`;
    }
    case "binance": {
      return `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@bookTicker`;
    }
    case "bybit": {
      return `wss://stream.bybit.com/v5/public/spot?__cachebust=${symbol.toLowerCase()}`;
    }
    case "coinbase": {
      return `wss://advanced-trade-ws.coinbase.com?__cachebust=${symbol.toLowerCase()}`;
    }
    case "okx": {
      return `wss://ws.okx.com:8443/ws/v5/public?__cachebust=${symbol.toLowerCase()}`;
    }
    case "prime_api": {
      return "wss://euc2.primeapi.io/";
    }
    case "pyth": {
      return `wss://hermes.pyth.network/ws?__cachebust=${symbol.toLowerCase()}`;
    }
    case "pyth_pro": {
      return `wss://pyth-lazer.dourolabs.app/v1/stream?ACCESS_TOKEN=${apiTokens.pyth_pro ?? ""}&__cachebust=${symbol.toLowerCase()}`;
    }
    case "twelve_data": {
      return `wss://ws.twelvedata.com/v1/quotes/price?apikey=${apiTokens.twelve_data ?? ""}`;
    }
    default: {
      break;
    }
  }

  return;
}

type UseDataStreamOpts = {
  dataSource: AllDataSourcesType;
  enabled?: boolean;
  symbol: Nullish<AllAllowedSymbols>;
};

/**
 * abstraction around setting up the streaming websocket
 * and getting price updates from various sources
 */
export function useDataStream({
  dataSource,
  enabled = true,
  symbol,
}: UseDataStreamOpts) {
  /** store */
  const { tokens } = usePythProApiTokensContext();

  /** queries */
  const { usdtToUsdRate } = useFetchUsdtToUsdRate({ enabled });

  /** hooks */
  const { onMessage: binanceOnMessage } = useBinanceWebSocket();
  const { onMessage: bybitOnMessage, onOpen: bybitOnOpen } =
    useBybitWebSocket();
  const { onMessage: coinbaseOnMessage, onOpen: coinbaseOnOpen } =
    useCoinbaseWebSocket();
  const { onMessage: infowayOnMessage, onOpen: infowayOnOpen } =
    useInfowayWebSocket();
  const { onMessage: okxOnMessage, onOpen: okxOnOpen } = useOKXWebSocket();
  const { onMessage: primeApiOnMessage, onOpen: primeApiOnOpen } =
    usePrimeApiWebSocket();
  const { onMessage: pythLazerOnMessage, onOpen: pythLazerOnOpen } =
    usePythLazerWebSocket();
  const { onMessage: pythOnMessage, onOpen: pythOnOpen } =
    usePythCoreWebSocket();
  const { onMessage: twelveOnMessage, onOpen: twelveOnOpen } =
    useTwelveWebSocket();

  /** callbacks */
  const onMessage = useCallback<UseWebSocketOpts["onMessage"]>(
    (s, e) => {
      if (isNullOrUndefined(usdtToUsdRate)) return;

      const strData = String(e.data);

      switch (dataSource) {
        case "binance": {
          binanceOnMessage(s, usdtToUsdRate, strData);
          break;
        }
        case "bybit": {
          bybitOnMessage(s, usdtToUsdRate, strData);
          break;
        }
        case "coinbase": {
          coinbaseOnMessage(s, usdtToUsdRate, strData);
          break;
        }
        case "infoway_io": {
          infowayOnMessage(s, usdtToUsdRate, strData);
          break;
        }
        case "okx": {
          okxOnMessage(s, usdtToUsdRate, strData);
          break;
        }
        case "prime_api": {
          primeApiOnMessage(s, usdtToUsdRate, strData);
          break;
        }
        case "pyth": {
          pythOnMessage(s, usdtToUsdRate, strData);
          break;
        }
        case "pyth_pro": {
          pythLazerOnMessage(s, usdtToUsdRate, strData);
          break;
        }
        case "twelve_data": {
          twelveOnMessage(s, usdtToUsdRate, strData);
          break;
        }
        default: {
          break;
        }
      }
    },
    [
      usdtToUsdRate,
      dataSource,
      binanceOnMessage,
      bybitOnMessage,
      coinbaseOnMessage,
      infowayOnMessage,
      okxOnMessage,
      primeApiOnMessage,
      pythOnMessage,
      pythLazerOnMessage,
      twelveOnMessage,
    ],
  );

  const onOpen = useCallback<NonNullable<UseWebSocketOpts["onOpen"]>>(
    (...args) => {
      switch (dataSource) {
        case "bybit": {
          bybitOnOpen?.(...args);
          break;
        }
        case "coinbase": {
          coinbaseOnOpen?.(...args);
          break;
        }
        case "infoway_io": {
          infowayOnOpen?.(...args);
          break;
        }
        case "okx": {
          okxOnOpen?.(...args);
          break;
        }
        case "prime_api": {
          primeApiOnOpen?.(...args);
          break;
        }
        case "pyth": {
          pythOnOpen?.(...args);
          break;
        }
        case "pyth_pro": {
          pythLazerOnOpen?.(...args);
          break;
        }
        case "twelve_data": {
          twelveOnOpen?.(...args);
          break;
        }
        default: {
          break;
        }
      }
    },
    [
      bybitOnOpen,
      coinbaseOnOpen,
      dataSource,
      infowayOnOpen,
      okxOnOpen,
      primeApiOnOpen,
      pythOnOpen,
      pythLazerOnOpen,
      twelveOnOpen,
    ],
  );

  /** websocket */
  const url = getUrlForSymbolAndDataSource(tokens, dataSource, symbol);
  const parsedUrl = url ? new URL(url) : undefined;
  parsedUrl?.searchParams.set("cachebust", symbol ?? "");
  const { status } = useWebSocket(
    // binance is really bad. it just explodes if it sees query params
    dataSource === "binance" ? url : parsedUrl?.toString(),
    {
      enabled: enabled && Boolean(url),
      onMessage,
      onOpen,
    },
  );

  return { status };
}
