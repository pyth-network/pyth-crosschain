import type { NextRequest } from "next/server";
import type { MessageEvent } from "ws";
import WebSocket from "ws";
import { z } from "zod";

import {
  PLAYGROUND_MAX_STREAM_DURATION_MS,
  PLAYGROUND_RATE_LIMIT_MAX_REQUESTS,
  PLAYGROUND_RATE_LIMIT_WINDOW_MS,
  PYTH_PRO_DEMO_TOKEN,
  PYTH_PRO_WS_ENDPOINT,
} from "../../../../config/pyth-pro";
import { checkRateLimit } from "../../../../lib/rate-limiter";

// Request body schema
const StreamRequestSchema = z.object({
  accessToken: z.string().optional().default(""),
  priceFeedIds: z
    .array(z.number())
    .min(1, "At least one price feed ID required"),
  properties: z.array(z.string()).min(1, "At least one property required"),
  formats: z.array(z.string()).min(1, "At least one format required"),
  channel: z.enum([
    "real_time",
    "fixed_rate@1ms",
    "fixed_rate@50ms",
    "fixed_rate@200ms",
    "fixed_rate@1000ms",
  ]),
  deliveryFormat: z.enum(["json", "binary"]),
  jsonBinaryEncoding: z.enum(["hex", "base64"]).optional().default("hex"),
  parsed: z.boolean().optional().default(true),
});

type StreamRequest = z.infer<typeof StreamRequestSchema>;

/**
 * Get client IP address from request headers
 */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

/**
 * Create SSE message string
 */
function createSseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Build the Pyth Pro subscription message
 */
function buildSubscriptionMessage(config: StreamRequest): string {
  return JSON.stringify({
    type: "subscribe",
    subscriptionId: 1,
    priceFeedIds: config.priceFeedIds,
    properties: config.properties,
    formats: config.formats,
    deliveryFormat: config.deliveryFormat,
    channel: config.channel,
    jsonBinaryEncoding: config.jsonBinaryEncoding,
    parsed: config.parsed,
  });
}

export async function POST(request: NextRequest) {
  // Parse and validate request body
  let config: StreamRequest;
  try {
    const body: unknown = await request.json();
    config = StreamRequestSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: error.errors }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Determine which token to use
  const demoToken = PYTH_PRO_DEMO_TOKEN;
  const usesDemoToken = !config.accessToken;

  if (usesDemoToken && !demoToken) {
    return new Response(
      JSON.stringify({ error: "Demo token not configured on server" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const accessToken = usesDemoToken ? demoToken : config.accessToken;

  // Apply rate limiting for demo token users
  if (usesDemoToken) {
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(clientIp, {
      windowMs: PLAYGROUND_RATE_LIMIT_WINDOW_MS,
      maxRequests: PLAYGROUND_RATE_LIMIT_MAX_REQUESTS,
    });

    if (!rateLimitResult.allowed) {
      const retryAfterSeconds = Math.ceil(rateLimitResult.resetIn / 1000);
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: `Too many requests. Try again in ${String(retryAfterSeconds)} seconds.`,
          resetIn: rateLimitResult.resetIn,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSeconds),
          },
        },
      );
    }
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let websocket: WebSocket | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.close();
        }
      };

      const sendEvent = (event: string, data: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(createSseMessage(event, data)));
        } catch {
          // Controller may be closed
          cleanup();
        }
      };

      // Set up auto-close timeout
      const maxDurationSeconds = Math.round(
        PLAYGROUND_MAX_STREAM_DURATION_MS / 1000,
      );
      timeoutId = setTimeout(() => {
        sendEvent("close", {
          timestamp: new Date().toISOString(),
          reason: "timeout",
          message: `Stream closed after ${String(maxDurationSeconds)} seconds`,
        });
        cleanup();
        controller.close();
      }, PLAYGROUND_MAX_STREAM_DURATION_MS);

      // Connect to Pyth Pro WebSocket using Bearer token authentication
      try {
        const wsUrl = PYTH_PRO_WS_ENDPOINT;
        const wsOptions = {
          headers: {
            Authorization: `Bearer ${accessToken ?? ""}`,
          },
        };
        websocket = new WebSocket(wsUrl, wsOptions);

        websocket.addEventListener("open", () => {
          sendEvent("connected", {
            timestamp: new Date().toISOString(),
            endpoint: PYTH_PRO_WS_ENDPOINT,
            message: "Connected to Pyth Pro WebSocket",
          });

          // Send subscription message
          const subscriptionMessage = buildSubscriptionMessage(config);
          websocket?.send(subscriptionMessage);

          sendEvent("subscribed", {
            timestamp: new Date().toISOString(),
            subscription: JSON.parse(subscriptionMessage) as unknown,
          });
        });

        websocket.addEventListener("message", (event: MessageEvent) => {
          try {
            // event.data can be string, Buffer, ArrayBuffer, or Buffer[]
            const rawData = event.data;
            const messageData =
              typeof rawData === "string"
                ? rawData
                : (Buffer.isBuffer(rawData)
                  ? rawData.toString("utf8")
                  : JSON.stringify(rawData));
            const parsedData: unknown = JSON.parse(messageData);
            sendEvent("message", {
              timestamp: new Date().toISOString(),
              data: parsedData,
            });
          } catch {
            // If not JSON, send as raw string
            const rawData = event.data;
            const dataStr =
              typeof rawData === "string"
                ? rawData
                : (Buffer.isBuffer(rawData)
                  ? rawData.toString("utf8")
                  : JSON.stringify(rawData));
            sendEvent("message", {
              timestamp: new Date().toISOString(),
              data: dataStr,
            });
          }
        });

        websocket.addEventListener("error", () => {
          sendEvent("error", {
            timestamp: new Date().toISOString(),
            error: "WebSocket connection error",
          });
        });

        websocket.addEventListener("close", (event) => {
          const closeEvent = event as { code?: number; reason?: string };
          if (isClosed) return;
          sendEvent("close", {
            timestamp: new Date().toISOString(),
            reason: "websocket_closed",
            code: closeEvent.code,
            message: closeEvent.reason ?? "WebSocket connection closed",
          });
          cleanup();
          controller.close();
        });
      } catch (error) {
        sendEvent("error", {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Failed to connect",
        });
        cleanup();
        controller.close();
      }
    },

    cancel() {
      // Client disconnected
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      isClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
