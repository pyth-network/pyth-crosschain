import asyncio
import json
from loguru import logger
import websockets

from price_state import PriceState


class LazerListener:
    """
    Subscribe to Lazer price updates for needed feeds.
    TODO: Will need to handle specific conversions/factors and exponents.
    """
    def __init__(self, config, price_state: PriceState):
        self.router_urls = config["lazer"]["router_urls"]
        self.api_key = config["lazer"]["api_key"]
        self.base_feed_id = config["lazer"]["base_feed_id"]
        self.quote_feed_id = config["lazer"]["quote_feed_id"]
        self.price_state = price_state

    def get_subscribe_request(self, subscription_id: int):
        return {
            "type": "subscribe",
            "subscriptionId": subscription_id,
            "priceFeedIds": [self.base_feed_id, self.quote_feed_id],
            "properties": ["price"],
            "formats": [],
            "deliveryFormat": "json",
            "channel": "fixed_rate@200ms",
            "parsed": True,
            "jsonBinaryEncoding": "base64",
        }

    async def subscribe_all(self):
        await asyncio.gather(*(self.subscribe_single(router_url) for router_url in self.router_urls))

    async def subscribe_single(self, router_url):
        while True:
            try:
                await self.subscribe_single_inner(router_url)
            except websockets.ConnectionClosed:
                logger.error("Connection to {} closed; retrying", router_url)
            except Exception as e:
                logger.exception("Error on {}: {}", router_url, e)

    async def subscribe_single_inner(self, router_url):
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        async with websockets.connect(router_url, additional_headers=headers) as ws:
            subscribe_request = self.get_subscribe_request(1)

            await ws.send(json.dumps(subscribe_request))
            logger.info("Sent Lazer subscribe request to {}", self.router_urls[0])

            # listen for updates
            async for message in ws:
                try:
                    data = json.loads(message)
                    self.parse_lazer_message(data)
                except json.JSONDecodeError as e:
                    logger.error("Failed to decode JSON message: {}", e)

    def parse_lazer_message(self, data):
        """
        For now, simply insert received prices into price_state

        :param data: Lazer price update json message
        :return: None (update price_state)
        """
        try:
            if data.get("type", "") != "streamUpdated":
                return
            price_feeds = data["parsed"]["priceFeeds"]
            logger.debug("price_feeds: {}", price_feeds)
            for feed_update in price_feeds:
                feed_id = feed_update.get("priceFeedId", None)
                price = feed_update.get("price", None)
                if feed_id is None or price is None:
                    continue
                if feed_id == self.base_feed_id:
                    self.price_state.lazer_base_price = price
                if feed_id == self.quote_feed_id:
                    self.price_state.lazer_quote_price = price
        except Exception as e:
            logger.error("parse_lazer_message error: {}", e)
