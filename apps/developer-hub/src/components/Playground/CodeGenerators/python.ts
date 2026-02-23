import type { PlaygroundConfig } from "../types";

/**
 * Generates Python code using websockets library
 */
export function generatePythonCode(config: PlaygroundConfig): string {
  // If accessToken is empty, use demo token placeholder
  const token = config.accessToken.trim() || "DEMO_TOKEN";
  const priceFeedIds =
    config.priceFeedIds.length > 0 ? config.priceFeedIds : [1, 2];
  const properties =
    config.properties.length > 0 ? config.properties : ["price"];
  const formats = config.formats.length > 0 ? config.formats : ["solana"];
  const channel = config.channel;

  const priceFeedIdsStr = priceFeedIds.join(", ");
  const propertiesStr = properties.map((prop) => `"${prop}"`).join(", ");
  const formatsStr = formats.map((format) => `"${format}"`).join(", ");

  return `#!/usr/bin/env python3
"""
Pyth Lazer WebSocket Client Example

This example demonstrates how to connect to Pyth Lazer and subscribe to price feeds.

Requirements:
    pip install websockets

Usage:
    python pyth_lazer_client.py
"""

import asyncio
import json
import signal
from typing import Any

try:
    import websockets
except ImportError:
    print("Please install websockets: pip install websockets")
    exit(1)


# Configuration
TOKEN = "${token}"
ENDPOINTS = [
    "wss://pyth-lazer-0.dourolabs.app/v1/stream",
    "wss://pyth-lazer-1.dourolabs.app/v1/stream",
    "wss://pyth-lazer-2.dourolabs.app/v1/stream",
]


async def subscribe_to_prices():
    """Connect to Pyth Lazer and subscribe to price feeds."""
    
    # Subscription request
    subscribe_request = {
        "type": "subscribe",
        "subscriptionId": 1,
        "priceFeedIds": [${priceFeedIdsStr}],
        "properties": [${propertiesStr}],
        "formats": [${formatsStr}],
        "channel": "${channel}",
        "deliveryFormat": "${config.deliveryFormat}",
        "jsonBinaryEncoding": "${config.jsonBinaryEncoding}",
        "parsed": ${config.parsed ? "True" : "False"},
    }

    # Headers for authentication
    headers = {
        "Authorization": f"Bearer {TOKEN}"
    }

    # Connect to the first endpoint (for production, connect to all for redundancy)
    uri = ENDPOINTS[0]
    
    print(f"Connecting to {uri}...")
    
    async with websockets.connect(uri, extra_headers=headers) as websocket:
        print("Connected! Sending subscription...")
        
        # Send subscription request
        await websocket.send(json.dumps(subscribe_request))
        print("Subscribed to price feeds. Waiting for updates...")
        
        # Listen for messages
        try:
            async for message in websocket:
                data = json.loads(message)
                handle_message(data)
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed")


def handle_message(data: dict[str, Any]) -> None:
    """Process incoming WebSocket messages."""
    
    msg_type = data.get("type")
    
    if msg_type == "streamUpdated":
        subscription_id = data.get("subscriptionId")
        parsed = data.get("parsed", {})
        timestamp = parsed.get("timestampUs", "N/A")
        price_feeds = parsed.get("priceFeeds", [])
        
        print(f"\\n--- Price Update (Subscription {subscription_id}) ---")
        print(f"Timestamp: {timestamp}")
        
        for feed in price_feeds:
            feed_id = feed.get("priceFeedId")
            price = feed.get("price", "N/A")
            exponent = feed.get("exponent", 0)
            feed_update_ts = feed.get("feedUpdateTimestamp", "N/A")

            # Calculate actual price if both values are present
            if price != "N/A" and exponent:
                actual_price = int(price) * (10 ** exponent)
                print(f"  Feed {feed_id}: {actual_price:.8f} (feedUpdateTimestamp={feed_update_ts})")
            else:
                print(f"  Feed {feed_id}: {price} (feedUpdateTimestamp={feed_update_ts})")
    
    elif msg_type == "subscribed":
        print(f"Successfully subscribed: {data}")
    
    elif msg_type == "error":
        print(f"Error: {data.get('message', 'Unknown error')}")
    
    else:
        print(f"Received: {data}")


def main():
    """Main entry point."""
    
    # Set up graceful shutdown
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    def shutdown():
        print("\\nShutting down...")
        for task in asyncio.all_tasks(loop):
            task.cancel()
    
    # Handle Ctrl+C
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, shutdown)
    
    try:
        loop.run_until_complete(subscribe_to_prices())
    except asyncio.CancelledError:
        pass
    finally:
        loop.close()


if __name__ == "__main__":
    main()
`;
}
