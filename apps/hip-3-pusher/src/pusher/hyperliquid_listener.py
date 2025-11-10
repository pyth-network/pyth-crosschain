import asyncio
import json
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


class HyperliquidListener:
    """
    Subscribe to any relevant Hyperliquid websocket streams
    See https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket
    """
    def __init__(self, config: Config, hl_oracle_state: PriceSourceState, hl_mark_state: PriceSourceState):
        self.hyperliquid_ws_urls = config.hyperliquid.hyperliquid_ws_urls
        self.asset_context_symbols = config.hyperliquid.asset_context_symbols
        self.hl_oracle_state = hl_oracle_state
        self.hl_mark_state = hl_mark_state

    def get_subscribe_request(self, asset):
        return {
            "method": "subscribe",
            "subscription": {"type": "activeAssetCtx", "coin": asset}
        }

    async def subscribe_all(self):
        await asyncio.gather(*(self.subscribe_single(hyperliquid_ws_url) for hyperliquid_ws_url in self.hyperliquid_ws_urls))

    @retry(
        retry=retry_if_exception_type((StaleConnectionError, websockets.ConnectionClosed)),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def subscribe_single(self, url):
        return await self.subscribe_single_inner(url)

    async def subscribe_single_inner(self, url):
        async with websockets.connect(url) as ws:
            for symbol in self.asset_context_symbols:
                subscribe_request = self.get_subscribe_request(symbol)
                await ws.send(json.dumps(subscribe_request))
                logger.info("Sent subscribe request for symbol: {} to {}", symbol,  url)

            # listen for updates
            while True:
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=STALE_TIMEOUT_SECONDS)
                    data = json.loads(message)
                    channel = data.get("channel", None)
                    if not channel:
                        logger.error("No channel in message: {}", data)
                    elif channel == "subscriptionResponse":
                        logger.debug("Received subscription response: {}", data)
                    elif channel == "error":
                        logger.error("Received Hyperliquid error response: {}", data)
                    elif channel == "activeAssetCtx":
                        self.parse_hyperliquid_ws_message(data)
                    else:
                        logger.error("Received unknown channel: {}", channel)
                except asyncio.TimeoutError:
                    raise StaleConnectionError(f"No messages in {STALE_TIMEOUT_SECONDS} seconds, reconnecting...")
                except websockets.ConnectionClosed:
                    raise
                except json.JSONDecodeError as e:
                    logger.error("Failed to decode JSON message: {} error: {}", message, e)
                except Exception as e:
                    logger.error("Unexpected exception: {}", e)

    def parse_hyperliquid_ws_message(self, message):
        try:
            ctx = message["data"]["ctx"]
            symbol = message["data"]["coin"]
            now = time.time()
            self.hl_oracle_state.put(symbol, PriceUpdate(ctx["oraclePx"], now))
            self.hl_mark_state.put(symbol, PriceUpdate(ctx["markPx"], now))
            logger.debug("on_activeAssetCtx: oraclePx: {} marketPx: {}", ctx["oraclePx"], ctx["markPx"])
        except Exception as e:
            logger.error("parse_hyperliquid_ws_message error: message: {} e: {}", message, e)
