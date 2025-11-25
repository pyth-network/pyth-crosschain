"use client";

import { useCallback, useEffect, useRef } from "react";
import type Sockette from "sockette";

import { usePythProStoreStateForWebsocket } from "./use-pyth-pro-store-state-for-websocket";
import type { AllowedForexSymbolsType } from "../../schemas/pyth/pyth-pro-demo-schema";
import type { UseDataProviderSocketHookReturnType } from "../../types/pyth-pro-demo";
import { isAllowedForexSymbol } from "../../util/pyth-pro-demo";

type PrimeSocketResponse =
  | {
      op: "auth" | "subscribe";
      status: number;
      tsp: number;
      msg: "Authenticated OK" | "Subscribed to 1 stream";
    }
  | { op: "price"; sym: AllowedForexSymbolsType; bid: string; ask: string };

type PrimeSocketRequest = {
  op: "subscribe";
  stream: "fx";
  pairs: [AllowedForexSymbolsType];
};

function sendAuthToken(socket: Sockette) {
  const msg = { op: "auth", key: API_TOKEN_PRIME_API };
  socket.json(msg);
}

export function usePrimeApiWebSocket(): UseDataProviderSocketHookReturnType {
  /** hooks */
  const { addDataPoint, selectedSource } = usePythProStoreStateForWebsocket();

  /** refs */
  const isAuthenticated = useRef(false);
  const subscriptionActive = useRef(false);

  /** callbacks */
  const onOpen = useCallback<
    NonNullable<UseDataProviderSocketHookReturnType["onOpen"]>
  >((s) => {
    sendAuthToken(s);
  }, []);

  const onMessage = useCallback<
    UseDataProviderSocketHookReturnType["onMessage"]
  >(
    (s, _, strData) => {
      const parsed = JSON.parse(strData) as PrimeSocketResponse;

      if (parsed.op === "auth") {
        if (parsed.msg === "Authenticated OK") {
          isAuthenticated.current = true;

          // once authenticated, immediately subscribe
          if (isAllowedForexSymbol(selectedSource)) {
            const msg: PrimeSocketRequest = {
              op: "subscribe",
              pairs: [selectedSource],
              stream: "fx",
            };
            s.json(msg);
          }
        }
        return;
      }

      if (
        parsed.op === "subscribe" &&
        parsed.msg === "Subscribed to 1 stream"
      ) {
        subscriptionActive.current = true;
        return;
      }

      if (
        subscriptionActive.current &&
        parsed.op === "price" &&
        isAllowedForexSymbol(selectedSource)
      ) {
        addDataPoint("prime_api", selectedSource, {
          price:
            (Number.parseFloat(parsed.bid) + Number.parseFloat(parsed.ask)) / 2,
          timestamp: Date.now(),
        });
      }
    },
    [addDataPoint, selectedSource],
  );

  /** effects */
  useEffect(() => {
    // whenever the user makes a new selection,
    // ensure the websocket has to go through the whole
    // procedure over again
    subscriptionActive.current = false;
    isAuthenticated.current = false;
  }, [selectedSource]);

  return { onOpen, onMessage };
}
