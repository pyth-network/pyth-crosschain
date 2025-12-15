import asyncio
import json
from loguru import logger
import websockets
from tenacity import retry, retry_if_exception_type, wait_fixed, stop_after_attempt

from pusher.config import Config, STALE_TIMEOUT_SECONDS
from pusher.exception import StaleConnectionError
from pusher.price_state import PriceSourceState, PriceUpdate


class HermesListener:
    """
    Subscribe to Hermes price updates for needed feeds.
    """
    def __init__(self, config: Config, hermes_state: PriceSourceState):
        self.hermes_urls = config.hermes.hermes_urls
        self.feed_ids = config.hermes.feed_ids
        self.hermes_state = hermes_state
        self.stop_after_attempt = config.hermes.stop_after_attempt

    def get_subscribe_request(self):
        return {
            "type": "subscribe",
            "ids": self.feed_ids,
            "verbose": False,
            "binary": True,
            "allow_out_of_order": False,
            "ignore_invalid_price_ids": False,
        }

    async def subscribe_all(self):
        if not self.feed_ids:
            logger.info("No Hermes subscriptions needed")
            return

        await asyncio.gather(*(self.subscribe_single(url) for url in self.hermes_urls))

    async def subscribe_single(self, url):
        logger.info("Starting Hermes listener loop: {}", url)

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
            subscribe_request = self.get_subscribe_request()

            await ws.send(json.dumps(subscribe_request))
            logger.info("Sent Hermes subscribe request to {}", url)

            # listen for updates
            while True:
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=STALE_TIMEOUT_SECONDS)
                    data = json.loads(message)
                    self.parse_hermes_message(data)
                except asyncio.TimeoutError:
                    logger.warning("HermesListener: No messages in {} seconds, reconnecting...", STALE_TIMEOUT_SECONDS)
                    raise StaleConnectionError(f"No messages in {STALE_TIMEOUT_SECONDS} seconds, reconnecting")
                except websockets.ConnectionClosed:
                    logger.warning("HermesListener: Connection closed, reconnecting...")
                    raise
                except json.JSONDecodeError as e:
                    logger.exception("Failed to decode JSON message: {}", repr(e))
                except Exception as e:
                    logger.exception("Unexpected exception: {}", repr(e))

    def parse_hermes_message(self, data):
        """
        For now, simply insert received prices into price_state

        :param data: Hermes price update json message
        :return: None (update price_state)
        """
        try:
            if data.get("type", "") != "price_update":
                return
            price_feed = data["price_feed"]
            id = price_feed["id"]
            price_object = data["price_feed"]["price"]
            price = price_object["price"]
            expo = price_object["expo"]
            publish_time = price_object["publish_time"]
            logger.debug("Hermes update: {} {} {} {}", id, price, expo, publish_time)
            self.hermes_state.put(id, PriceUpdate(price, publish_time))
        except Exception as e:
            logger.exception("parse_hermes_message error: {}", repr(e))
