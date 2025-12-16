import asyncio
import json
from enum import StrEnum

import websockets
from loguru import logger
from tenacity import retry, retry_if_exception_type, wait_fixed, stop_after_attempt
import time

from pusher.config import Config, STALE_TIMEOUT_SECONDS
from pusher.exception import StaleConnectionError
from pusher.price_state import PriceSourceState, PriceUpdate

# This will be in config, but note here.
# Other RPC providers exist but so far we've seen their support is incomplete.
HYPERLIQUID_MAINNET_WS_URL = "wss://api.hyperliquid.xyz/ws"
HYPERLIQUID_TESTNET_WS_URL = "wss://api.hyperliquid-testnet.xyz/ws"

class HLChannel(StrEnum):
    """ Hyperliquid websocket subscription channels. See https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions """

    # activeAssetCtx includes oracle and mark price for perps (either main HyperCore or HIP-3)
    CHANNEL_ACTIVE_ASSET_CTX = "activeAssetCtx"
    # HL market mid price
    CHANNEL_ALL_MIDS = "allMids"
    # either subscription ack or error
    CHANNEL_SUBSCRIPTION_RESPONSE = "subscriptionResponse"
    # application-level ping response
    CHANNEL_PONG = "pong"
    # error response
    CHANNEL_ERROR = "error"

DATA_CHANNELS = [HLChannel.CHANNEL_ACTIVE_ASSET_CTX, HLChannel.CHANNEL_ALL_MIDS]


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
        self.ws_ping_interval = config.hyperliquid.ws_ping_interval
        self.stop_after_attempt = config.hyperliquid.stop_after_attempt

    def get_subscribe_request(self, asset):
        return {
            "method": "subscribe",
            "subscription": {"type": "activeAssetCtx", "coin": asset}
        }

    async def subscribe_all(self):
        await asyncio.gather(*(self.subscribe_single(hyperliquid_ws_url) for hyperliquid_ws_url in self.hyperliquid_ws_urls))

    async def subscribe_single(self, url):
        logger.info("Starting Hyperliquid listener loop: {}", url)

        @retry(
            retry=retry_if_exception_type(Exception),
            wait=wait_fixed(1),
            stop=stop_after_attempt(self.stop_after_attempt),
            reraise=True,
        )
        async def _run():
            return await self.subscribe_single_inner(url)

        return await _run()

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

            now = time.time()
            channel_last_message_timestamp = {channel: now for channel in HLChannel}
            last_ping_timestamp = now

            # listen for updates
            while True:
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=STALE_TIMEOUT_SECONDS)
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
                        channel_last_message_timestamp[channel] = now
                    elif channel == HLChannel.CHANNEL_ALL_MIDS:
                        self.parse_hyperliquid_all_mids_update(data, now)
                        channel_last_message_timestamp[channel] = now
                    elif channel == HLChannel.CHANNEL_PONG:
                        logger.debug("Received pong")
                    else:
                        logger.error("Received unknown channel: {}", channel)

                    # check for stale channels
                    for channel in DATA_CHANNELS:
                        if now - channel_last_message_timestamp[channel] > STALE_TIMEOUT_SECONDS:
                            logger.warning("HyperliquidLister: no messages in channel {} stale in {} seconds; reconnecting...", channel, STALE_TIMEOUT_SECONDS)
                            raise StaleConnectionError(f"No messages in channel {channel} in {STALE_TIMEOUT_SECONDS} seconds, reconnecting...")

                    # ping if we need to
                    if now - last_ping_timestamp > self.ws_ping_interval:
                        await ws.send(json.dumps({"method": "ping"}))
                        last_ping_timestamp = now
                except asyncio.TimeoutError:
                    logger.warning("HyperliquidListener: No messages overall in {} seconds, reconnecting...", STALE_TIMEOUT_SECONDS)
                    raise StaleConnectionError(f"No messages overall in {STALE_TIMEOUT_SECONDS} seconds, reconnecting...")
                except websockets.ConnectionClosed as e:
                    rc, rr = e.rcvd.code if e.rcvd else None, e.rcvd.reason if e.rcvd else None
                    logger.warning("HyperliquidListener: Websocket connection closed (code={} reason={}); reconnecting...", rc, rr)
                    raise
                except json.JSONDecodeError as e:
                    logger.exception("Failed to decode JSON message: {} error: {}", message, repr(e))
                except Exception as e:
                    logger.exception("Unexpected exception: {}", repr(e))

    def parse_hyperliquid_active_asset_ctx_update(self, message, now):
        try:
            ctx = message["data"]["ctx"]
            symbol = message["data"]["coin"]
            self.hl_oracle_state.put(symbol, PriceUpdate(ctx["oraclePx"], now))
            self.hl_mark_state.put(symbol, PriceUpdate(ctx["markPx"], now))
            logger.debug("activeAssetCtx symbol: {} oraclePx: {} markPx: {}", symbol, ctx["oraclePx"], ctx["markPx"])
        except Exception as e:
            logger.exception("parse_hyperliquid_active_asset_ctx_update error: message: {} e: {}", message, repr(e))

    def parse_hyperliquid_all_mids_update(self, message, now):
        try:
            mids = message["data"]["mids"]
            for mid in mids:
                self.hl_mid_state.put(mid, PriceUpdate(mids[mid], now))
            logger.debug("allMids: {}", mids)
        except Exception as e:
            logger.error("parse_hyperliquid_all_mids_update error: message: {} e: {}", message, e)