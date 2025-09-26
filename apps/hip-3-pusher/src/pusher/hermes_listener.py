import asyncio
import json
from loguru import logger
import time
import websockets
from tenacity import retry, retry_if_exception_type, wait_exponential

from pusher.config import Config, STALE_TIMEOUT_SECONDS
from pusher.exception import StaleConnection
from pusher.price_state import PriceState, PriceUpdate


class HermesListener:
    """
    Subscribe to Hermes price updates for needed feeds.
    """
    def __init__(self, config: Config, price_state: PriceState):
        self.hermes_urls = config.hermes.hermes_urls
        self.base_feed_id = config.hermes.base_feed_id
        self.quote_feed_id = config.hermes.quote_feed_id
        self.price_state = price_state

    def get_subscribe_request(self):
        return {
            "type": "subscribe",
            "ids": [self.base_feed_id, self.quote_feed_id],
            "verbose": False,
            "binary": True,
            "allow_out_of_order": False,
            "ignore_invalid_price_ids": False,
        }

    async def subscribe_all(self):
        await asyncio.gather(*(self.subscribe_single(url) for url in self.hermes_urls))

    @retry(
        retry=retry_if_exception_type((StaleConnection, websockets.ConnectionClosed)),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def subscribe_single(self, url):
        return await self.subscribe_single_inner(url)

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
                    raise StaleConnection(f"No messages in {STALE_TIMEOUT_SECONDS} seconds, reconnecting")
                except websockets.ConnectionClosed:
                    raise
                except json.JSONDecodeError as e:
                    logger.error("Failed to decode JSON message: {}", e)
                except Exception as e:
                    logger.error("Unexpected exception: {}", e)

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
            now = time.time()
            if id == self.base_feed_id:
                self.price_state.hermes_base_price = PriceUpdate(price, now)
            if id == self.quote_feed_id:
                self.price_state.hermes_quote_price = PriceUpdate(price, now)
        except Exception as e:
            logger.error("parse_hermes_message error: {}", e)
