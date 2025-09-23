import asyncio
import json
import websockets
from loguru import logger
import time

from config import Config
from price_state import PriceState

# This will be in config, but note here.
# Other RPC providers exist but so far we've seen their support is incomplete.
HYPERLIQUID_MAINNET_WS_URL = "wss://api.hyperliquid.xyz/ws"
HYPERLIQUID_TESTNET_WS_URL = "wss://api.hyperliquid-testnet.xyz/ws"


class HyperliquidListener:
    """
    Subscribe to any relevant Hyperliquid websocket streams
    See https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket
    """
    def __init__(self, config: Config, price_state: PriceState):
        self.hyperliquid_ws_urls = config.hyperliquid.hyperliquid_ws_urls
        self.market_symbol = config.hyperliquid.market_symbol
        self.price_state = price_state

    def get_subscribe_request(self, asset):
        return {
            "method": "subscribe",
            "subscription": {"type": "activeAssetCtx", "coin": asset}
        }

    async def subscribe_all(self):
        await asyncio.gather(*(self.subscribe_single(hyperliquid_ws_url) for hyperliquid_ws_url in self.hyperliquid_ws_urls))

    async def subscribe_single(self, url):
        while True:
            try:
                await self.subscribe_single_inner(url)
            except websockets.ConnectionClosed:
                logger.error("Connection to {} closed; retrying", url)
            except Exception as e:
                logger.exception("Error on {}: {}", url, e)

    async def subscribe_single_inner(self, url):
        async with websockets.connect(url) as ws:
            subscribe_request = self.get_subscribe_request(self.market_symbol)
            await ws.send(json.dumps(subscribe_request))
            logger.info("Sent subscribe request to {}", url)

            # listen for updates
            async for message in ws:
                try:
                    data = json.loads(message)
                    if "ctx" not in message:
                        # TODO: Should check subscription status response
                        logger.debug("HL update without ctx: {}", message)
                        continue
                    self.parse_hyperliquid_ws_message(data)
                except json.JSONDecodeError as e:
                    logger.error("Failed to decode JSON message: {}", e)

    def parse_hyperliquid_ws_message(self, message):
        try:
            ctx = message["data"]["ctx"]
            self.price_state.hl_oracle_price = ctx["oraclePx"]
            self.price_state.hl_mark_price = ctx["markPx"]
            logger.debug("on_activeAssetCtx: oraclePx: {} marketPx: {}", self.price_state.hl_oracle_price,
                         self.price_state.hl_mark_price)
            self.price_state.latest_hl_timestamp = time.time()
        except Exception as e:
            logger.error("parse_hyperliquid_ws_message error: message: {} e: {}", e)
