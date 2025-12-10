import asyncio

from hyperliquid.utils.types import SpotMeta, Meta
from loguru import logger

from hyperliquid.info import Info
from hyperliquid.utils import constants

from pusher.config import Config
from pusher.metrics import Metrics


class UserLimitListener:
    def __init__(self, config: Config, metrics: Metrics, address: str):
        self.address = address.lower()
        self.metrics = metrics
        self.interval = config.hyperliquid.user_limit_interval
        self.dex = config.hyperliquid.market_name

        base_url = constants.TESTNET_API_URL if config.hyperliquid.use_testnet else constants.MAINNET_API_URL
        self.info = Info(base_url=base_url, skip_ws=True, meta=Meta(universe=[]), spot_meta=SpotMeta(universe=[], tokens=[]))

    async def run(self):
        logger.info("Starting user limit listener url: {} address: {} interval: {}", self.info.base_url, self.address, self.interval)
        while True:
            try:
                response = await asyncio.to_thread(self._request)
                logger.debug("userRateLimit response: {}", response)
                balance = response["nRequestsSurplus"] - response["nRequestsCap"] - response["nRequestsUsed"]
                logger.debug("userRateLimit user: {} balance: {}", self.address, balance)
                self.metrics.user_request_balance.set(balance, {"dex": self.dex, "user": self.address})
            except Exception as e:
                logger.error("userRateLimit query failed: {}", e)
            await asyncio.sleep(self.interval)

    def _request(self):
        return self.info.user_rate_limit(self.address)
