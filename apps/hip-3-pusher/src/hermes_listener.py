import asyncio
import json
from loguru import logger
import time
import websockets

from config import Config
from price_state import PriceState


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
            subscribe_request = self.get_subscribe_request()

            await ws.send(json.dumps(subscribe_request))
            logger.info("Sent Hermes subscribe request to {}", url)

            # listen for updates
            async for message in ws:
                try:
                    data = json.loads(message)
                    self.parse_hermes_message(data)
                except json.JSONDecodeError as e:
                    logger.error("Failed to decode JSON message: {}", e)

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
            if id == self.base_feed_id:
                self.price_state.hermes_base_price = price
            if id == self.quote_feed_id:
                self.price_state.hermes_quote_price = price
            self.price_state.latest_hermes_timestamp = time.time()
        except Exception as e:
            logger.error("parse_hermes_message error: {}", e)
