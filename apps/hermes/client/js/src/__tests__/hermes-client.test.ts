import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { HermesClient } from "../hermes-client.js";

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  count: number,
) => void;

const startServer = async (handler: Handler) => {
  let count = 0;
  const server: Server = createServer((request, response) => {
    count += 1;
    handler(request, response, count);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    close: () => {
      server.closeAllConnections();
      server.close();
    },
    requests: () => count,
    url: `http://127.0.0.1:${port.toString()}`,
  };
};

describe("HermesClient timeout", () => {
  it("bounds the request and all of its retries by `timeout`", async () => {
    // A server that accepts the request and never answers it
    const server = await startServer(() => undefined);
    try {
      const client = new HermesClient(server.url, {
        httpRetries: 3,
        timeout: 200,
      });
      const start = Date.now();

      await expect(client.getPriceFeeds()).rejects.toMatchObject({
        name: "TimeoutError",
      });

      expect(Date.now() - start).toBeLessThan(1000);
      expect(server.requests()).toBe(1);
    } finally {
      server.close();
    }
  });

  it("still retries a failed request within the timeout", async () => {
    const server = await startServer((_request, response, count) => {
      if (count === 1) {
        response.statusCode = 500;
        response.end();
        return;
      }
      response.setHeader("content-type", "application/json");
      response.end("[]");
    });
    try {
      const client = new HermesClient(server.url, {
        httpRetries: 3,
        timeout: 2000,
      });

      await expect(client.getPriceFeeds()).resolves.toEqual([]);
      expect(server.requests()).toBe(2);
    } finally {
      server.close();
    }
  });
});
