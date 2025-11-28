"use client";

/* eslint-disable no-console */
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SocketteOptions } from "sockette";
import Sockette from "sockette";
import throttle from "throttleit";

export type UseWebSocketOpts = {
  enabled?: boolean;
  onClose?: (
    socket: Sockette,
    ...args: Parameters<NonNullable<WebSocket["onclose"]>>
  ) => void;
  onError?: (
    socket: Sockette,
    ...args: Parameters<NonNullable<WebSocket["onerror"]>>
  ) => void;
  onMessage: (
    socket: Sockette,
    ...args: Parameters<NonNullable<WebSocket["onmessage"]>>
  ) => void;
  onOpen?: (
    socket: Sockette,
    ...args: Parameters<NonNullable<WebSocket["onopen"]>>
  ) => void;
  onReconnect?: (
    socket: Sockette,
    ...args: Parameters<NonNullable<SocketteOptions["onreconnect"]>>
  ) => void;
};

export function useWebSocket(
  url: Nullish<string>,
  {
    enabled = true,
    onClose,
    onError,
    onMessage,
    onOpen,
    onReconnect,
  }: UseWebSocketOpts,
) {
  /** state */
  const [status, setStatus] = useState<
    "closed" | "connecting" | "connected" | "reconnecting"
  >("closed");

  /** refs */
  const wsRef = useRef<Sockette | undefined>(undefined);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onReconnectRef = useRef(onReconnect);

  /** callbacks */
  const connectSocket = useCallback(() => {
    if (!enabled || !url) return;

    console.info("connecting to", url);

    const w = new Sockette(url, {
      onclose: (...args) => {
        if (wsRef.current !== w) return;

        setStatus("closed");
        onCloseRef.current?.(w, ...args);
      },
      onerror: (...args) => {
        if (wsRef.current !== w) return;

        setStatus("closed");
        onErrorRef.current?.(w, ...args);
      },
      onmessage: (...args) => {
        if (wsRef.current !== w) return;

        onMessageRef.current(w, ...args);
      },
      onopen: (...args) => {
        if (wsRef.current !== w) return;

        setStatus("connected");
        onOpenRef.current?.(w, ...args);
      },
      onreconnect: (...args) => {
        if (wsRef.current !== w) return;

        setStatus("reconnecting");
        onReconnectRef.current?.(w, ...args);
      },
    });

    setStatus("connecting");

    wsRef.current = w;
  }, [enabled, url]);

  const closeSocket = useCallback(() => {
    if (!wsRef.current) return;

    if (url) console.info("closing", url);
    wsRef.current.close();
    setStatus("closed");
  }, [url]);

  /** effects */
  useEffect(() => {
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
    // onmessage can only get called at most once every 50 ms
    onMessageRef.current = throttle(onMessage, 50);
    onOpenRef.current = onOpen;
    onReconnectRef.current = onReconnect;
  });

  useEffect(() => {
    closeSocket();
    connectSocket();

    return () => {
      closeSocket();
    };
  }, [closeSocket, connectSocket]);

  return useMemo(
    () => ({
      close: closeSocket,
      reconnect: () => {
        setStatus("reconnecting");
        wsRef.current?.reconnect();
      },
      send: (content: unknown) => {
        wsRef.current?.send(content);
      },
      sendJson: (json: object) => {
        wsRef.current?.json(json);
      },
      status,
    }),
    [closeSocket, status],
  );
}
