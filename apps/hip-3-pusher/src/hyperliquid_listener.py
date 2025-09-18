from loguru import logger

from hyperliquid.info import Info
from hyperliquid.utils.constants import TESTNET_API_URL, MAINNET_API_URL

from price_state import PriceState


class HyperliquidListener:
    """
    Subscribe to any relevant Hyperliquid websocket streams
    See https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket
    """
    def __init__(self, config: dict, price_state: PriceState):
        self.market_symbol = config["hyperliquid"]["market_symbol"]
        url = TESTNET_API_URL if config["hyperliquid"].get("use_testnet", True) else MAINNET_API_URL
        self.info = Info(base_url=url)
        self.price_state = price_state

    def subscribe(self):
        self.info.subscribe({"type": "activeAssetCtx", "coin": self.market_symbol}, self.on_activeAssetCtx)

    def on_activeAssetCtx(self, message):
        """
        Parse oraclePx and markPx from perp context update

        :param message: activeAssetCtx websocket update message
        :return: None
        """
        ctx = message["data"]["ctx"]
        self.price_state.latest_oracle_price = ctx["oraclePx"]
        self.price_state.latest_mark_price = ctx["markPx"]
        logger.debug("on_activeAssetCtx: oraclePx: {} marketPx: {}", self.price_state.latest_oracle_price, self.price_state.latest_mark_price)
