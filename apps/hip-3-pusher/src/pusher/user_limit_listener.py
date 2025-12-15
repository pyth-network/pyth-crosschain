import asyncio
import time

from hyperliquid.utils.types import SpotMeta, Meta
from loguru import logger

from hyperliquid.info import Info
from hyperliquid.utils import constants

from pusher.config import Config
from pusher.metrics import Metrics


class UserLimitListener:
    """
    Periodically polls the Hyperliquid API to monitor the updater account's
    reserved requests.

    For the oracle updater account (single or multisig), poll
    info/userRateLimit and update the hip_3_relayer_user_request_balance
    metric for that account. Topping up can be done with the provided script
    to call reserveRequestWeight.
    """

    def __init__(self, config: Config, metrics: Metrics, address: str):
        self.address = address.lower()
        self.metrics = metrics
        self.interval = config.hyperliquid.user_limit_interval
        self.dex = config.hyperliquid.market_name

        base_url = constants.TESTNET_API_URL if config.hyperliquid.use_testnet else constants.MAINNET_API_URL
        self.info = Info(base_url=base_url, skip_ws=True, meta=Meta(universe=[]), spot_meta=SpotMeta(universe=[], tokens=[]))

    async def run(self):
        logger.info("Starting user limit listener url: {} address: {} interval: {}", self.info.base_url, self.address, self.interval)
        most_recent_timestamp = None
        most_recent_balance = None

        while True:
            try:
                now = time.time()
                if not most_recent_timestamp or now - most_recent_timestamp > self.interval:
                    response = await asyncio.to_thread(self._request)
                    logger.debug("userRateLimit response: {}", response)
                    new_balance = response["nRequestsSurplus"] + response["nRequestsCap"] - response["nRequestsUsed"]
                    logger.debug("userRateLimit user: {} balance: {}", self.address, new_balance)

                    most_recent_timestamp = now
                    most_recent_balance = new_balance

                self.metrics.user_request_balance.set(most_recent_balance, {"dex": self.dex, "user": self.address})
            except Exception as e:
                logger.exception("userRateLimit query failed: {}", repr(e))

            # want to update every 60s to keep metric populated in Grafana
            await asyncio.sleep(60)

    def _request(self):
        return self.info.user_rate_limit(self.address)
