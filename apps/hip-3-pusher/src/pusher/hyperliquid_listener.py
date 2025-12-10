import asyncio
import json
from enum import StrEnum

import websockets
from loguru import logger
from tenacity import retry, retry_if_exception_type, wait_exponential
import time

from pusher.config import Config, STALE_TIMEOUT_SECONDS
from pusher.exception import StaleConnectionError
from pusher.price_state import PriceSourceState, PriceUpdate

# This will be in config, but note here.
# Other RPC providers exist but so far we've seen their support is incomplete.
HYPERLIQUID_MAINNET_WS_URL = "wss://api.hyperliquid.xyz/ws"
HYPERLIQUID_TESTNET_WS_URL = "wss://api.hyperliquid-testnet.xyz/ws"

class HLChannel(StrEnum):
    CHANNEL_ACTIVE_ASSET_CTX = "activeAssetCtx"
    CHANNEL_ALL_MIDS = "allMids"


class HyperliquidListener:
    """
    Subscribe to any relevant Hyperliquid websocket streams
    See https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket
    """
    def __init__(self, config: Config, hl_oracle_state: PriceSourceState, hl_mark_state: PriceSourceState, hl_mid_state: PriceSourceState):
        self.market_name = config.hyperliquid.market_name
        self.hyperliquid_ws_urls = config.hyperliquid.hyperliquid_ws_urls
        self.asset_context_symbols = config.hyperliquid.asset_context_symbols
        self.hl_oracle_state = hl_oracle_state
        self.hl_mark_state = hl_mark_state
        self.hl_mid_state = hl_mid_state

    def get_subscribe_request(self, asset):
        return {
            "method": "subscribe",
            "subscription": {"type": "activeAssetCtx", "coin": asset}
        }

    async def subscribe_all(self):
        await asyncio.gather(*(self.subscribe_single(hyperliquid_ws_url) for hyperliquid_ws_url in self.hyperliquid_ws_urls))

    @retry(
        retry=retry_if_exception_type(Exception),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def subscribe_single(self, url):
        logger.info("Starting Hyperliquid listener loop: {}", url)
        return await self.subscribe_single_inner(url)

    async def subscribe_single_inner(self, url):
        async with websockets.connect(url) as ws:
            for symbol in self.asset_context_symbols:
                subscribe_request = self.get_subscribe_request(symbol)
                await ws.send(json.dumps(subscribe_request))
                logger.info("Sent subscribe request for symbol: {} to {}", symbol,  url)

            subscribe_all_mids_request = {
                "method": "subscribe",
                "subscription": {"type": "allMids", "dex": self.market_name}
            }
            await ws.send(json.dumps(subscribe_all_mids_request))
            logger.info("Sent subscribe request for allMids for dex: {} to {}", self.market_name, url)

            channel_last_message_timestamp = {channel: time.time() for channel in HLChannel}
            # listen for updates
            while True:
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=STALE_TIMEOUT_SECONDS)
                    data = json.loads(message)
                    channel = data.get("channel", None)
                    now = time.time()
                    if not channel:
                        logger.error("No channel in message: {}", data)
                    elif channel == "subscriptionResponse":
                        logger.debug("Received subscription response: {}", data)
                    elif channel == "error":
                        logger.error("Received Hyperliquid error response: {}", data)
                    elif channel == HLChannel.CHANNEL_ACTIVE_ASSET_CTX:
                        self.parse_hyperliquid_active_asset_ctx_update(data, now)
                        channel_last_message_timestamp[channel] = now
                    elif channel == HLChannel.CHANNEL_ALL_MIDS:
                        self.parse_hyperliquid_all_mids_update(data, now)
                        channel_last_message_timestamp[channel] = now
                    else:
                        logger.error("Received unknown channel: {}", channel)

                    # check for stale channels
                    for channel in HLChannel:
                        if now - channel_last_message_timestamp[channel] > STALE_TIMEOUT_SECONDS:
                            logger.warning("HyperliquidLister: no messages in channel {} stale in {} seconds; reconnecting...", channel, STALE_TIMEOUT_SECONDS)
                            raise StaleConnectionError(f"No messages in channel {channel} in {STALE_TIMEOUT_SECONDS} seconds, reconnecting...")
                except asyncio.TimeoutError:
                    logger.warning("HyperliquidListener: No messages overall in {} seconds, reconnecting...", STALE_TIMEOUT_SECONDS)
                    raise StaleConnectionError(f"No messages overall in {STALE_TIMEOUT_SECONDS} seconds, reconnecting...")
                except websockets.ConnectionClosed:
                    logger.warning("HyperliquidListener: Connection closed, reconnecting...")
                    raise
                except json.JSONDecodeError as e:
                    logger.error("Failed to decode JSON message: {} error: {}", message, e)
                except Exception as e:
                    logger.error("Unexpected exception: {}", e)

    def parse_hyperliquid_active_asset_ctx_update(self, message, now):
        try:
            ctx = message["data"]["ctx"]
            symbol = message["data"]["coin"]
            self.hl_oracle_state.put(symbol, PriceUpdate(ctx["oraclePx"], now))
            self.hl_mark_state.put(symbol, PriceUpdate(ctx["markPx"], now))
            logger.debug("activeAssetCtx symbol: {} oraclePx: {} markPx: {}", symbol, ctx["oraclePx"], ctx["markPx"])
        except Exception as e:
            logger.error("parse_hyperliquid_active_asset_ctx_update error: message: {} e: {}", message, e)

    def parse_hyperliquid_all_mids_update(self, message, now):
        try:
            mids = message["data"]["mids"]
            for mid in mids:
                self.hl_mid_state.put(mid, PriceUpdate(mids[mid], now))
            logger.debug("allMids: {}", mids)
        except Exception as e:
            logger.error("parse_hyperliquid_all_mids_update error: message: {} e: {}", message, e)