/* eslint-disable no-console */
import { useEffect, useMemo, useRef, useState } from "react";
import Sockette from "sockette";

export type UseWebSocketOpts<T = unknown> = {
  /**
   * unique ID for this websocket connection for logging purposes
   */
  id: string;

  /**
   * fired when the connection first opens
   */
  onConnected?: (url: string, socket: Sockette) => void;

  /**
   * fired whenever a message is received
   * over the socket. it is up to you
   * to determine how to parse it
   */
  onMessage?: (msg: T, url: string, socket: Sockette) => void;

  /**
   * url to the WSS endpoint used for the connection
   */
  url: string;
};

/**
 * abstracts away the whole websocket connection dance,
 * and allows you to connect to one or more websockets
 * through a single, convenient hook
 */
export function useWebsockets(opts: UseWebSocketOpts[]) {
  /** state */
  const [connectedMap, setConnectedMap] = useState<Record<string, boolean>>({});

  /** refs */
  const socketMap = useRef<Record<string, Sockette | undefined>>({});

  /** effects */
  useEffect(() => {
    for (const opt of opts) {
      const handleCloseOrError = () => {
        console.warn(`${opt.id}: connection was closed.`);
        setConnectedMap((prev) => ({ ...prev, [opt.url]: false }));
      };

      const s = new Sockette(opt.url, {
        onclose: handleCloseOrError,
        onerror: handleCloseOrError,
        onmessage: (e) => {
          opt.onMessage?.(e.data, opt.url, s);
        },
        onopen: () => {
          console.info(`${opt.id}: connected!`);
          opt.onConnected?.(opt.url, s);
          setConnectedMap((prev) => ({ ...prev, [opt.url]: true }));
        },
      });

      socketMap.current[opt.url] = s;
    }
  }, [opts]);

  /** memos */
  return useMemo(() => {
    const disconnect = (url: string) => {
      const s = socketMap.current[url];
      if (!s) return;

      s.close();
      socketMap.current[url] = undefined;
    };

    return {
      disconnect,
      disconnectAll: () => {
        for (const url of Object.keys(socketMap.current)) {
          disconnect(url);
        }
      },
      connectedMap,
    };
  }, [connectedMap]);
}
