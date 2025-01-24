import { PythPriceListener } from "../pyth-price-listener";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { Logger } from "pino";

describe("PythPriceListener", () => {
  let logger: Logger;
  let connection: PriceServiceConnection;
  let listener: PythPriceListener;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Save original console.error and mock it
    originalConsoleError = console.error;
    console.error = jest.fn();

    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    } as unknown as Logger;

    // Use real Hermes beta endpoint for testing
    connection = new PriceServiceConnection("https://hermes.pyth.network");
  });

  afterEach(() => {
    // Clean up websocket connection
    connection.closeWebSocket();
    // Restore original console.error
    console.error = originalConsoleError;
  });

  it("should handle invalid price feeds gracefully", async () => {
    const validFeedId =
      "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"; // BTC/USD
    const invalidFeedId =
      "0000000000000000000000000000000000000000000000000000000000000000";

    const priceItems = [
      { id: validFeedId, alias: "BTC/USD" },
      { id: invalidFeedId, alias: "INVALID/PRICE" },
    ];

    listener = new PythPriceListener(connection, priceItems, logger);

    // Should throw 404 for getLatestPriceFeeds
    await expect(listener.start()).rejects.toMatchObject({
      response: { status: 404 },
    });

    // Wait for websocket connection and error handling to complete
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (
          (logger.error as jest.Mock).mock.calls.some((call) =>
            call[0].includes(`Price feed ${invalidFeedId}`)
          )
        ) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    });

    // Verify invalid feed error was logged
    expect(logger.error).toHaveBeenCalledWith(
      `Price feed ${invalidFeedId} (INVALID/PRICE) not found`
    );

    // Verify resubscription message was logged
    expect(logger.info).toHaveBeenCalledWith(
      "Resubscribing with valid feeds only"
    );

    // Verify priceIds was updated to only include valid feeds
    expect(listener["priceIds"]).toEqual([validFeedId]);
  });
});
