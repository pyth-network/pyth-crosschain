"use client";

import { useCallback, useRef, useState } from "react";

import type { PlaygroundConfig } from "../types";

export type StreamStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "closed";

export type StreamMessage = {
  id: string;
  timestamp: string;
  event: string;
  data: unknown;
};

type StreamError = {
  message: string;
  resetIn?: number;
};

type UseStreamExecutionReturn = {
  status: StreamStatus;
  messages: StreamMessage[];
  error: StreamError | undefined;
  startStream: (config: PlaygroundConfig) => void;
  stopStream: () => void;
  clearMessages: () => void;
};

/**
 * Hook to manage SSE connection for streaming Pyth Pro price updates.
 */
export function useStreamExecution(): UseStreamExecutionReturn {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [error, setError] = useState<StreamError | undefined>(undefined);

  const eventSourceRef = useRef<EventSource | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  const messageIdRef = useRef(0);

  const generateMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return `msg-${String(messageIdRef.current)}`;
  }, []);

  const addMessage = useCallback(
    (event: string, data: unknown, timestamp?: string) => {
      const message: StreamMessage = {
        id: generateMessageId(),
        timestamp: timestamp ?? new Date().toISOString(),
        event,
        data,
      };
      setMessages((prev) => [...prev, message]);
    },
    [generateMessageId],
  );

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = undefined;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = undefined;
    }
    setStatus("closed");
  }, []);

  const startStream = useCallback(
    (config: PlaygroundConfig) => {
      // Clean up any existing connection
      stopStream();

      setStatus("connecting");
      setError(undefined);
      setMessages([]);
      messageIdRef.current = 0;

      // Create abort controller for fetch
      abortControllerRef.current = new AbortController();

      // Build request body
      const requestBody = {
        accessToken: config.accessToken,
        priceFeedIds: config.priceFeedIds,
        properties: config.properties,
        formats: config.formats,
        channel: config.channel,
        deliveryFormat: config.deliveryFormat,
        jsonBinaryEncoding: config.jsonBinaryEncoding,
        parsed: config.parsed,
      };

      // Use fetch with streaming response
      fetch("/api/playground/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = (await response.json()) as {
              error?: string;
              message?: string;
              resetIn?: number;
            };
            throw new Error(
              errorData.message ??
                errorData.error ??
                `HTTP ${String(response.status)}`,
            );
          }

          if (!response.body) {
            throw new Error("No response body");
          }

          setStatus("connected");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          const processLine = (line: string) => {
            if (line.startsWith("event: ")) {
              // Store event type for next data line
              buffer = line.slice(7);
            } else if (line.startsWith("data: ") && buffer) {
              const eventType = buffer;
              const dataStr = line.slice(6);
              try {
                const eventData = JSON.parse(dataStr) as {
                  timestamp?: string;
                  data?: unknown;
                  error?: string;
                  message?: string;
                  reason?: string;
                };

                // Handle different event types
                if (eventType === "error") {
                  setError({
                    message: eventData.error ?? "Unknown error",
                  });
                  setStatus("error");
                } else if (eventType === "close") {
                  setStatus("closed");
                }

                addMessage(
                  eventType,
                  eventData.data ?? eventData,
                  eventData.timestamp,
                );
              } catch {
                // Non-JSON data
                addMessage(eventType, dataStr);
              }
              buffer = "";
            }
          };

          // Read stream
          const readStream = async (): Promise<void> => {
            const { done, value } = await reader.read();
            if (done) {
              setStatus("closed");
              return;
            }

            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n");

            for (const line of lines) {
              if (line.trim()) {
                processLine(line);
              }
            }

            return readStream();
          };

          await readStream();
        })
        .catch((fetchError: unknown) => {
          if (fetchError instanceof Error) {
            if (fetchError.name === "AbortError") {
              // User cancelled, don't show error
              return;
            }
            setError({ message: fetchError.message });
            setStatus("error");
            addMessage("error", { error: fetchError.message });
          } else {
            setError({ message: "Unknown error occurred" });
            setStatus("error");
            addMessage("error", { error: "Unknown error occurred" });
          }
        });
    },
    [stopStream, addMessage],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    messageIdRef.current = 0;
  }, []);

  return {
    status,
    messages,
    error,
    startStream,
    stopStream,
    clearMessages,
  };
}
