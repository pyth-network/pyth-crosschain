"use client";

import type { UseWebSocketOpts } from "@pythnetwork/react-hooks/use-websocket";
import { useWebSocket } from "@pythnetwork/react-hooks/use-websocket";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { useCallback } from "react";

import type { UseDataStreamOpts, UseDataStreamReturnType } from "./types";
import { useBinanceWebSocket } from "./use-binance-websocket";
import { useBybitWebSocket } from "./use-bybit-websocket";
import { useCoinbaseWebSocket } from "./use-coinbase-websocket";
import { useFetchUsdtToUsdRate } from "./use-fetch-usdt-to-rate";
import { useOKXWebSocket } from "./use-okx-websocket";
import { usePythCoreWebSocket } from "./use-pyth-core-websocket";
import { usePythLazerWebSocket } from "./use-pyth-lazer-websocket";
import { usePythProApiTokensContext } from "../../context/pyth-pro-demo";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  ApiTokensState,
} from "../../schemas/pyth/pyth-pro-demo-schema";

function getUrlForSymbolAndDataSource(
  apiTokens: ApiTokensState,
  dataSource: AllDataSourcesType,
  symbol: Nullish<AllAllowedSymbols>,
): Nullish<string> {
  if (!symbol) return;

  switch (dataSource) {
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
    case "pyth": {
      return `wss://hermes.pyth.network/ws?__cachebust=${symbol.toLowerCase()}`;
    }
    case "pyth_pro": {
      return `wss://pyth-lazer.dourolabs.app/v1/stream?ACCESS_TOKEN=${apiTokens.pyth_pro ?? ""}&__cachebust=${symbol.toLowerCase()}`;
    }
    default: {
      break;
    }
  }

  return;
}

/**
 * abstraction around setting up the streaming websocket
 * and getting price updates from various sources
 */
export function useDataStream({
  dataSource,
  enabled,
  symbol,
}: UseDataStreamOpts): UseDataStreamReturnType {
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
  const { onMessage: okxOnMessage, onOpen: okxOnOpen } = useOKXWebSocket();
  const { onMessage: pythLazerOnMessage, onOpen: pythLazerOnOpen } =
    usePythLazerWebSocket();
  const { onMessage: pythOnMessage, onOpen: pythOnOpen } =
    usePythCoreWebSocket();

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
        case "okx": {
          okxOnMessage(s, usdtToUsdRate, strData);
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
      okxOnMessage,
      pythOnMessage,
      pythLazerOnMessage,
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
        case "okx": {
          okxOnOpen?.(...args);
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
        default: {
          break;
        }
      }
    },
    [
      bybitOnOpen,
      coinbaseOnOpen,
      dataSource,
      okxOnOpen,
      pythOnOpen,
      pythLazerOnOpen,
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
