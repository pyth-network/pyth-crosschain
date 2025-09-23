import type { JsonUpdate, ParsedFeedPayload } from "../src/index.js";

// Helper function to render all feeds in place
export function renderFeeds(feedData: Map<string, {
    priceFeedId: string | number;
    price: number;
    confidence: number | null;
    exponent: number;
    lastUpdate: Date;
}>) {
    // Clear screen and move cursor to top
    process.stdout.write('\u001B[2J\u001B[H');

    if (feedData.size === 0) {
        console.log('Waiting for price feed data...\n');
        return;
    }

    console.log('🔴 Live Lazer Price Feeds\n');
    console.log('━'.repeat(80));

    // Sort feeds by ID for consistent display order
    const sortedFeeds = [...feedData.values()].sort((a, b) => {
        const aId = String(a.priceFeedId);
        const bId = String(b.priceFeedId);
        return aId.localeCompare(bId);
    });

    for (const [index, feed] of sortedFeeds.entries()) {
        const readablePrice = feed.price * Math.pow(10, feed.exponent);
        const readableConfidence = feed.confidence === null ? null : feed.confidence * Math.pow(10, feed.exponent);
        const timeAgo = Math.round((Date.now() - feed.lastUpdate.getTime()));

        console.log(`\u001B[36m${index + 1}. Feed ID: ${feed.priceFeedId}\u001B[0m`);
        console.log(`   💰 Price: \u001B[32m$${readablePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\u001B[0m`);

        if (readableConfidence !== null) {
            console.log(`   📊 Confidence: \u001B[33m±$${readableConfidence.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\u001B[0m`);
        }

        console.log(`   ⏰ Updated: \u001B[90m${timeAgo}ms ago\u001B[0m`);
        console.log('');
    }

    console.log('━'.repeat(80));
    console.log(`\u001B[90mLast refresh: ${new Date().toLocaleTimeString()}\u001B[0m`);
}

// Helper function to update price feed data and refresh display
export function refreshFeedDisplay(response: any, feedData: Map<string, {
    priceFeedId: string | number;
    price: number;
    confidence: number | null;
    exponent: number;
    lastUpdate: Date;
}>) {
    if (response.parsed?.priceFeeds) {
        response.parsed.priceFeeds.forEach((feed: any, index: number) => {
            if (feed.price && feed.exponent !== undefined) {
                const feedId = feed.priceFeedId === undefined ? `feed_${index + 1}` : String(feed.priceFeedId);
                const readableConfidence = feed.confidence ? Number(feed.confidence) : null;

                feedData.set(feedId, {
                    priceFeedId: feed.priceFeedId === undefined ? `feed_${index + 1}` : feed.priceFeedId,
                    price: Number(feed.price),
                    confidence: readableConfidence,
                    exponent: feed.exponent,
                    lastUpdate: new Date()
                });
            }
        });

        renderFeeds(feedData);
    }
}

// Helper function to calculate human-friendly price values
export function displayParsedPrices(response: JsonUpdate) {
    if (response.parsed?.priceFeeds) {
        response.parsed.priceFeeds.forEach((feed: ParsedFeedPayload, index: number) => {
            if (feed.price && feed.exponent !== undefined) {
                const readablePrice = Number(feed.price) * Math.pow(10, feed.exponent);
                const readableConfidence = feed.confidence ? Number(feed.confidence) * Math.pow(10, feed.exponent) : null;

                console.log(`Feed ${feed.priceFeedId || index + 1}:`);
                console.log(`\tPrice: $${readablePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`);
                if (readableConfidence !== null) {
                    console.log(`\tConfidence: ±$${readableConfidence.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`);
                }
            }
        });
    }
}
