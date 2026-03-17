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

function parseRawSocketDataToStr(rawData: WebSocket.Data) {
  if (typeof rawData === "string") {
    return rawData;
  }
  if (Buffer.isBuffer(rawData)) {
    return rawData.toString("utf8");
  }
  return JSON.stringify(rawData);
}

// Request body schema
const StreamRequestSchema = z.object({
  accessToken: z.string().optional().default(""),
  channel: z.enum([
    "real_time",
    "fixed_rate@1ms",
    "fixed_rate@50ms",
    "fixed_rate@200ms",
    "fixed_rate@1000ms",
  ]),
  deliveryFormat: z.enum(["json", "binary"]),
  formats: z.array(z.string()).min(1, "At least one format required"),
  jsonBinaryEncoding: z.enum(["hex", "base64"]).optional().default("hex"),
  parsed: z.boolean().optional().default(true),
  priceFeedIds: z
    .array(z.number())
    .min(1, "At least one price feed ID required"),
  properties: z.array(z.string()).min(1, "At least one property required"),
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
    channel: config.channel,
    deliveryFormat: config.deliveryFormat,
    formats: config.formats,
    jsonBinaryEncoding: config.jsonBinaryEncoding,
    parsed: config.parsed,
    priceFeedIds: config.priceFeedIds,
    properties: config.properties,
    subscriptionId: 1,
    type: "subscribe",
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
        JSON.stringify({ details: error.errors, error: "Invalid request" }),
        { headers: { "Content-Type": "application/json" }, status: 400 },
      );
    }
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }

  // Determine which token to use
  const demoToken = PYTH_PRO_DEMO_TOKEN;
  const usesDemoToken = !config.accessToken;

  if (usesDemoToken && !demoToken) {
    return new Response(
      JSON.stringify({ error: "Demo token not configured on server" }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }

  const accessToken = usesDemoToken ? demoToken : config.accessToken;

  // Apply rate limiting for demo token users
  if (usesDemoToken) {
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(clientIp, {
      maxRequests: PLAYGROUND_RATE_LIMIT_MAX_REQUESTS,
      windowMs: PLAYGROUND_RATE_LIMIT_WINDOW_MS,
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
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSeconds),
          },
          status: 429,
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
          message: `Stream closed after ${String(maxDurationSeconds)} seconds`,
          reason: "timeout",
          timestamp: new Date().toISOString(),
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
            endpoint: PYTH_PRO_WS_ENDPOINT,
            message: "Connected to Pyth Pro WebSocket",
            timestamp: new Date().toISOString(),
          });

          // Send subscription message
          const subscriptionMessage = buildSubscriptionMessage(config);
          websocket?.send(subscriptionMessage);

          sendEvent("subscribed", {
            subscription: JSON.parse(subscriptionMessage) as unknown,
            timestamp: new Date().toISOString(),
          });
        });

        websocket.addEventListener("message", (event: MessageEvent) => {
          try {
            // event.data can be string, Buffer, ArrayBuffer, or Buffer[]
            const rawData = event.data;
            const messageData = parseRawSocketDataToStr(rawData);
            const parsedData: unknown = JSON.parse(messageData);
            sendEvent("message", {
              data: parsedData,
              timestamp: new Date().toISOString(),
            });
          } catch {
            // If not JSON, send as raw string
            const rawData = event.data;
            const dataStr = parseRawSocketDataToStr(rawData);
            sendEvent("message", {
              data: dataStr,
              timestamp: new Date().toISOString(),
            });
          }
        });

        websocket.addEventListener("error", () => {
          sendEvent("error", {
            error: "WebSocket connection error",
            timestamp: new Date().toISOString(),
          });
        });

        websocket.addEventListener("close", (event) => {
          const closeEvent = event as { code?: number; reason?: string };
          if (isClosed) return;
          sendEvent("close", {
            code: closeEvent.code,
            message: closeEvent.reason ?? "WebSocket connection closed",
            reason: "websocket_closed",
            timestamp: new Date().toISOString(),
          });
          cleanup();
          controller.close();
        });
      } catch (error) {
        sendEvent("error", {
          error: error instanceof Error ? error.message : "Failed to connect",
          timestamp: new Date().toISOString(),
        });
        cleanup();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    },
  });
}
