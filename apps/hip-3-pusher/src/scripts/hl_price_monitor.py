#!/usr/bin/env python3
"""
Hyperliquid WebSocket price monitor.

Subscribes to Hyperliquid's activeAssetCtx channel for specified coins
and outputs oracle and mark prices in CSV format.

Usage:
    python hl_price_monitor.py cash:USA500 cash:TSLA BTC ETH

Output format:
    <timestamp_utc>,<coin>,<oraclePx>,<markPx>
"""

import argparse
import asyncio
import json
import sys
from datetime import UTC, datetime

import websockets

HYPERLIQUID_MAINNET_WS_URL = "wss://api.hyperliquid.xyz/ws"
HYPERLIQUID_TESTNET_WS_URL = "wss://api.hyperliquid-testnet.xyz/ws"


def get_timestamp() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


async def subscribe_and_print(coins: list[str], ws_url: str) -> None:
    async with websockets.connect(ws_url) as ws:
        for coin in coins:
            subscribe_request = {
                "method": "subscribe",
                "subscription": {"type": "activeAssetCtx", "coin": coin},
            }
            await ws.send(json.dumps(subscribe_request))
            print(f"# Subscribed to {coin}", file=sys.stderr)

        while True:
            try:
                message = await ws.recv()
                data = json.loads(message)
                channel = data.get("channel")

                if channel == "activeAssetCtx":
                    ctx = data["data"]["ctx"]
                    coin = data["data"]["coin"]
                    oracle_px = ctx.get("oraclePx", "")
                    mark_px = ctx.get("markPx", "")
                    timestamp = get_timestamp()
                    print(f"{timestamp},{coin},{oracle_px},{mark_px}")
                    sys.stdout.flush()
                elif channel == "subscriptionResponse":
                    print(f"# Subscription confirmed: {data}", file=sys.stderr)
                elif channel == "error":
                    print(f"# Error: {data}", file=sys.stderr)

            except websockets.ConnectionClosed as e:
                print(f"# Connection closed: {e}", file=sys.stderr)
                raise
            except json.JSONDecodeError as e:
                print(f"# JSON decode error: {e}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Monitor Hyperliquid oracle and mark prices via WebSocket"
    )
    parser.add_argument(
        "coins",
        nargs="+",
        help="Coins to subscribe to (e.g., cash:USA500 cash:TSLA BTC)",
    )
    parser.add_argument(
        "--testnet",
        action="store_true",
        help="Use testnet WebSocket URL instead of mainnet",
    )
    parser.add_argument(
        "--url",
        type=str,
        default=None,
        help="Custom WebSocket URL (overrides --testnet)",
    )

    args = parser.parse_args()

    if args.url:
        ws_url = args.url
    elif args.testnet:
        ws_url = HYPERLIQUID_TESTNET_WS_URL
    else:
        ws_url = HYPERLIQUID_MAINNET_WS_URL

    print(f"# Connecting to {ws_url}", file=sys.stderr)
    print("# Output format: timestamp,coin,oraclePx,markPx", file=sys.stderr)

    try:
        asyncio.run(subscribe_and_print(args.coins, ws_url))
    except KeyboardInterrupt:
        print("\n# Interrupted by user", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
