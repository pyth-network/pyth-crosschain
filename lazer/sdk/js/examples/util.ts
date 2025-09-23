/* eslint-disable no-console */

import type { JsonUpdate } from "../src/index.js";

// Helper function to render all feeds in place
export function renderFeeds(
  feedData: Map<
    string,
    {
      priceFeedId: number;
      price: number;
      confidence: number | undefined;
      exponent: number;
      lastUpdate: Date;
    }
  >,
  symbolsMap: Map<number, string>,
) {
  // Clear screen and move cursor to top
  process.stdout.write("\u001B[2J\u001B[H");

  if (feedData.size === 0) {
    console.log("Waiting for price feed data...\n");
    return;
  }

  console.log("🔴 Live Lazer Price Feeds\n");
  console.log("━".repeat(80));

  // Sort feeds by ID for consistent display order
  const sortedFeeds = [...feedData.values()].sort((a, b) => {
    const aId = String(a.priceFeedId);
    const bId = String(b.priceFeedId);
    return aId.localeCompare(bId);
  });

  for (const [index, feed] of sortedFeeds.entries()) {
    const readablePrice = feed.price * Math.pow(10, feed.exponent);
    const readableConfidence =
      feed.confidence === undefined
        ? undefined
        : feed.confidence * Math.pow(10, feed.exponent);
    const timeAgo = Math.round(Date.now() - feed.lastUpdate.getTime());

    const symbolName = symbolsMap.get(Number(feed.priceFeedId));
    const displayName = symbolName
      ? `Feed ID: ${feed.priceFeedId.toString()} (${symbolName})`
      : `Feed ID: ${feed.priceFeedId.toString()}`;

    console.log(`\u001B[36m${(index + 1).toString()}. ${displayName}\u001B[0m`);
    console.log(
      `   💰 Price: \u001B[32m$${readablePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\u001B[0m`,
    );

    if (readableConfidence !== undefined) {
      console.log(
        `   📊 Confidence: \u001B[33m±$${readableConfidence.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\u001B[0m`,
      );
    }

    console.log(
      `   ⏰ Updated: \u001B[90m${timeAgo.toString()}ms ago\u001B[0m`,
    );
    console.log("");
  }

  console.log("━".repeat(80));
  console.log(
    `\u001B[90mLast refresh: ${new Date().toLocaleTimeString()}\u001B[0m`,
  );
}

// Helper function to update price feed data and refresh display
export function refreshFeedDisplay(
  response: JsonUpdate,
  feedData: Map<
    string,
    {
      priceFeedId: number;
      price: number;
      confidence: number | undefined;
      exponent: number;
      lastUpdate: Date;
    }
  >,
  symbolsMap: Map<number, string>,
) {
  if (response.parsed?.priceFeeds) {
    for (const feed of response.parsed.priceFeeds) {
      if (feed.price && feed.exponent !== undefined) {
        const readableConfidence = feed.confidence
          ? Number(feed.confidence)
          : undefined;

        feedData.set(feed.priceFeedId.toString(), {
          priceFeedId: feed.priceFeedId,
          price: Number(feed.price),
          confidence: readableConfidence,
          exponent: feed.exponent,
          lastUpdate: new Date(),
        });
      }
    }

    renderFeeds(feedData, symbolsMap);
  }
}

// Helper function to calculate human-friendly price values
export function displayParsedPrices(response: JsonUpdate) {
  if (response.parsed?.priceFeeds) {
    for (const [index, feed] of response.parsed.priceFeeds.entries()) {
      if (feed.price && feed.exponent !== undefined) {
        const readablePrice = Number(feed.price) * Math.pow(10, feed.exponent);
        const readableConfidence = feed.confidence
          ? Number(feed.confidence) * Math.pow(10, feed.exponent)
          : undefined;

        console.log(`Feed ${(index + 1).toString()}:`);
        console.log(
          `\tPrice: $${readablePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`,
        );
        if (readableConfidence !== undefined) {
          console.log(
            `\tConfidence: ±$${readableConfidence.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`,
          );
        }
      }
    }
  }
}
