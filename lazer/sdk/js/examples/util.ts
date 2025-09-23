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
    process.stdout.write('\x1b[2J\x1b[H');

    if (feedData.size === 0) {
        console.log('Waiting for price feed data...\n');
        return;
    }

    console.log('🔴 Live Lazer Price Feeds\n');
    console.log('━'.repeat(80));

    // Sort feeds by ID for consistent display order
    const sortedFeeds = Array.from(feedData.values()).sort((a, b) => {
        const aId = String(a.priceFeedId);
        const bId = String(b.priceFeedId);
        return aId.localeCompare(bId);
    });

    sortedFeeds.forEach((feed, index) => {
        const readablePrice = feed.price * Math.pow(10, feed.exponent);
        const readableConfidence = feed.confidence !== null ? feed.confidence * Math.pow(10, feed.exponent) : null;
        const timeAgo = Math.round((Date.now() - feed.lastUpdate.getTime()));

        console.log(`\x1b[36m${index + 1}. Feed ID: ${feed.priceFeedId}\x1b[0m`);
        console.log(`   💰 Price: \x1b[32m$${readablePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\x1b[0m`);

        if (readableConfidence !== null) {
            console.log(`   📊 Confidence: \x1b[33m±$${readableConfidence.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}\x1b[0m`);
        }

        console.log(`   ⏰ Updated: \x1b[90m${timeAgo}ms ago\x1b[0m`);
        console.log('');
    });

    console.log('━'.repeat(80));
    console.log(`\x1b[90mLast refresh: ${new Date().toLocaleTimeString()}\x1b[0m`);
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
                const feedId = feed.priceFeedId !== undefined ? String(feed.priceFeedId) : `feed_${index + 1}`;
                const readableConfidence = feed.confidence ? Number(feed.confidence) : null;

                feedData.set(feedId, {
                    priceFeedId: feed.priceFeedId !== undefined ? feed.priceFeedId : `feed_${index + 1}`,
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
