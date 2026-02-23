"""
Hyperliquid WebSocket listener for oracle, mark, and mid prices.

This module subscribes to Hyperliquid's WebSocket API to receive real-time
price data that can be used as sources in the price waterfall.

DATA SOURCES PROVIDED:
- hl_oracle: Oracle prices from activeAssetCtx (use as primary source for consistency)
- hl_mark: Mark prices from activeAssetCtx (use for external reference)
- hl_mid: Mid prices from allMids (use with oracle_mid_average for mark price)

COMMON USE CASE:
A HIP-3 market might echo the main Hyperliquid oracle as its primary source
for consistency, using Pyth Lazer/Hermes as fallbacks:

  BTC = [
      { source_type = "single", source = { source_name = "hl_oracle", source_id = "BTC" } },
      { source_type = "pair", base_source = { source_name = "lazer", ... }, ... },
  ]
"""

import asyncio
import json
import time
from enum import StrEnum
from typing import Any

import websockets
from loguru import logger
from tenacity import retry, retry_if_exception_type, wait_fixed

from pusher.config import STALE_TIMEOUT_SECONDS, Config
from pusher.exception import StaleConnectionError
from pusher.price_state import PriceSourceState, PriceUpdate

# Default WebSocket URLs (can be overridden in config)
# Note: Other RPC providers exist but may have incomplete support for all channels
HYPERLIQUID_MAINNET_WS_URL = "wss://api.hyperliquid.xyz/ws"
HYPERLIQUID_TESTNET_WS_URL = "wss://api.hyperliquid-testnet.xyz/ws"


class HLChannel(StrEnum):
    """
    Hyperliquid WebSocket subscription channels.
    See https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions
    """

    # activeAssetCtx: Per-asset context including oracle and mark prices
    # Works for both main HyperCore perps and HIP-3 markets
    # -> Feeds hl_oracle and hl_mark source states
    CHANNEL_ACTIVE_ASSET_CTX = "activeAssetCtx"

    # allMids: Market mid prices for all assets in a dex
    # -> Feeds hl_mid source state (used by oracle_mid_average)
    CHANNEL_ALL_MIDS = "allMids"

    # Control channels (not price data)
    CHANNEL_SUBSCRIPTION_RESPONSE = "subscriptionResponse"
    CHANNEL_PONG = "pong"
    CHANNEL_ERROR = "error"


# Channels that carry price data - used for staleness detection
DATA_CHANNELS = [HLChannel.CHANNEL_ACTIVE_ASSET_CTX, HLChannel.CHANNEL_ALL_MIDS]


class HyperliquidListener:
    """
    Subscribe to Hyperliquid WebSocket streams for oracle/mark/mid prices.

    SUBSCRIPTIONS:
    1. activeAssetCtx per symbol in asset_context_symbols
       - Provides oraclePx -> hl_oracle state
       - Provides markPx -> hl_mark state

    2. allMids for the configured market_name
       - Provides mid prices -> hl_mid state
       - Used by oracle_mid_average source type

    STALENESS HANDLING:
    If no messages are received on a data channel for STALE_TIMEOUT_SECONDS,
    the connection is considered stale and will be reconnected.
    """

    def __init__(
        self,
        config: Config,
        hl_oracle_state: PriceSourceState,
        hl_mark_state: PriceSourceState,
        hl_mid_state: PriceSourceState,
    ) -> None:
        self.market_name = config.hyperliquid.market_name
        self.hyperliquid_ws_urls = config.hyperliquid.hyperliquid_ws_urls
        self.asset_context_symbols = config.hyperliquid.asset_context_symbols
        self.hl_oracle_state = hl_oracle_state
        self.hl_mark_state = hl_mark_state
        self.hl_mid_state = hl_mid_state
        self.ws_ping_interval = config.hyperliquid.ws_ping_interval
        self.stop_after_attempt = config.hyperliquid.stop_after_attempt

    def get_subscribe_request(self, asset: str) -> dict[str, Any]:
        return {
            "method": "subscribe",
            "subscription": {"type": "activeAssetCtx", "coin": asset},
        }

    async def subscribe_all(self) -> None:
        await asyncio.gather(
            *(
                self.subscribe_single(hyperliquid_ws_url)
                for hyperliquid_ws_url in self.hyperliquid_ws_urls
            )
        )

    async def subscribe_single(self, url: str) -> None:
        logger.info("Starting Hyperliquid listener loop: {}", url)

        @retry(
            retry=retry_if_exception_type(Exception),
            wait=wait_fixed(1),
            # For now, disable stop_after_attempt to avoid killing process.
            # stop=stop_after_attempt(self.stop_after_attempt),
            reraise=True,
        )
        async def _run() -> None:
            return await self.subscribe_single_inner(url)

        return await _run()

    async def subscribe_single_inner(self, url: str) -> None:
        async with websockets.connect(url) as ws:
            for symbol in self.asset_context_symbols:
                subscribe_request = self.get_subscribe_request(symbol)
                await ws.send(json.dumps(subscribe_request))
                logger.info("Sent subscribe request for symbol: {} to {}", symbol, url)

            subscribe_all_mids_request = {
                "method": "subscribe",
                "subscription": {"type": "allMids", "dex": self.market_name},
            }
            await ws.send(json.dumps(subscribe_all_mids_request))
            logger.info(
                "Sent subscribe request for allMids for dex: {} to {}",
                self.market_name,
                url,
            )

            now = time.time()
            channel_last_message_timestamp: dict[HLChannel, float] = {
                channel: now for channel in HLChannel
            }
            last_ping_timestamp = now

            # listen for updates
            message: str | bytes = ""
            while True:
                try:
                    message = await asyncio.wait_for(
                        ws.recv(), timeout=STALE_TIMEOUT_SECONDS
                    )
                    data = json.loads(message)
                    channel = data.get("channel", None)
                    now = time.time()
                    if not channel:
                        logger.error("No channel in message: {}", data)
                    elif channel == HLChannel.CHANNEL_SUBSCRIPTION_RESPONSE:
                        logger.info("Received subscription response: {}", data)
                    elif channel == HLChannel.CHANNEL_ERROR:
                        logger.error("Received Hyperliquid error response: {}", data)
                    elif channel == HLChannel.CHANNEL_ACTIVE_ASSET_CTX:
                        self.parse_hyperliquid_active_asset_ctx_update(data, now)
                        channel_last_message_timestamp[HLChannel(channel)] = now
                    elif channel == HLChannel.CHANNEL_ALL_MIDS:
                        self.parse_hyperliquid_all_mids_update(data, now)
                        channel_last_message_timestamp[HLChannel(channel)] = now
                    elif channel == HLChannel.CHANNEL_PONG:
                        logger.debug("Received pong")
                    else:
                        logger.error("Received unknown channel: {}", channel)

                    # check for stale channels
                    for data_channel in DATA_CHANNELS:
                        if (
                            now - channel_last_message_timestamp[data_channel]
                            > STALE_TIMEOUT_SECONDS
                        ):
                            logger.warning(
                                "HyperliquidLister: no messages in channel {} stale in {} seconds; reconnecting...",
                                data_channel,
                                STALE_TIMEOUT_SECONDS,
                            )
                            raise StaleConnectionError(
                                f"No messages in channel {data_channel} in {STALE_TIMEOUT_SECONDS} seconds, reconnecting..."
                            )

                    # ping if we need to
                    if now - last_ping_timestamp > self.ws_ping_interval:
                        await ws.send(json.dumps({"method": "ping"}))
                        last_ping_timestamp = now
                except TimeoutError:
                    logger.warning(
                        "HyperliquidListener: No messages overall in {} seconds, reconnecting...",
                        STALE_TIMEOUT_SECONDS,
                    )
                    raise StaleConnectionError(
                        f"No messages overall in {STALE_TIMEOUT_SECONDS} seconds, reconnecting..."
                    ) from None
                except websockets.ConnectionClosed as e:
                    rc = e.rcvd.code if e.rcvd else None
                    rr = e.rcvd.reason if e.rcvd else None
                    logger.warning(
                        "HyperliquidListener: Websocket connection closed (code={} reason={}); reconnecting...",
                        rc,
                        rr,
                    )
                    raise
                except json.JSONDecodeError as e:
                    logger.exception(
                        "Failed to decode JSON message: {} error: {}", message, repr(e)
                    )
                except Exception as e:
                    logger.exception("Unexpected exception: {}", repr(e))

    def parse_hyperliquid_active_asset_ctx_update(
        self, message: dict[str, Any], now: float
    ) -> None:
        try:
            ctx = message["data"]["ctx"]
            symbol = message["data"]["coin"]
            self.hl_oracle_state.put(symbol, PriceUpdate(ctx["oraclePx"], now))
            self.hl_mark_state.put(symbol, PriceUpdate(ctx["markPx"], now))
            logger.debug(
                "activeAssetCtx symbol: {} oraclePx: {} markPx: {}",
                symbol,
                ctx["oraclePx"],
                ctx["markPx"],
            )
        except Exception as e:
            logger.exception(
                "parse_hyperliquid_active_asset_ctx_update error: message: {} e: {}",
                message,
                repr(e),
            )

    def parse_hyperliquid_all_mids_update(
        self, message: dict[str, Any], now: float
    ) -> None:
        try:
            mids = message["data"]["mids"]
            for mid in mids:
                self.hl_mid_state.put(mid, PriceUpdate(mids[mid], now))
            logger.debug("allMids: {}", mids)
        except Exception as e:
            logger.error(
                "parse_hyperliquid_all_mids_update error: message: {} e: {}", message, e
            )
