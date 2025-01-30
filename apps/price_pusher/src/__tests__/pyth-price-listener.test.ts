import { PythPriceListener } from "../pyth-price-listener";
import { HermesClient } from "@pythnetwork/hermes-client";
import { Logger } from "pino";

describe("PythPriceListener", () => {
  let logger: Logger;
  let connection: HermesClient;
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
    connection = new HermesClient("https://hermes.pyth.network");
  });

  afterEach(() => {
    // Clean up health check interval
    if (listener) {
      listener.cleanup();
    }
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

    await listener.start();

    // Wait for both error handlers to complete
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const errorCalls = (logger.error as jest.Mock).mock.calls;

        // Check for both HTTP and websocket error logs
        const hasHttpError = errorCalls.some(
          (call) => call[0] === "Failed to get latest price feeds:"
        );
        const hasGetLatestError = errorCalls.some((call) =>
          call[0].includes("not found for getLatestPriceFeeds")
        );
        const hasWsError = errorCalls.some((call) =>
          call[0].includes("not found for subscribePriceFeedUpdates")
        );

        if (hasHttpError && hasGetLatestError && hasWsError) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    });

    // Verify HTTP error was logged
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to get latest price feeds:",
      expect.objectContaining({
        message: "Request failed with status code 404",
      })
    );

    // Verify invalid feed error was logged
    expect(logger.error).toHaveBeenCalledWith(
      `Price feed ${invalidFeedId} (INVALID/PRICE) not found for getLatestPriceFeeds`
    );

    // Verify invalid feed error was logged
    expect(logger.error).toHaveBeenCalledWith(
      `Price feed ${invalidFeedId} (INVALID/PRICE) not found for subscribePriceFeedUpdates`
    );

    // Verify resubscription message was logged
    expect(logger.info).toHaveBeenCalledWith(
      "Resubscribing with valid feeds only"
    );

    // Verify priceIds was updated to only include valid feeds
    expect(listener["priceIds"]).toEqual([validFeedId]);
  });
});
