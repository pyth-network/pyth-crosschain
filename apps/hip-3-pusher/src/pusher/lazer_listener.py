import asyncio
import json
from loguru import logger
import time
import websockets
from tenacity import retry, retry_if_exception_type, wait_exponential

from pusher.config import Config, STALE_TIMEOUT_SECONDS
from pusher.exception import StaleConnection
from pusher.price_state import PriceState, PriceUpdate


class LazerListener:
    """
    Subscribe to Lazer price updates for needed feeds.
    """
    def __init__(self, config: Config, price_state: PriceState):
        self.lazer_urls = config.lazer.lazer_urls
        self.api_key = config.lazer.lazer_api_key
        self.base_feed_id = config.lazer.base_feed_id
        self.quote_feed_id = config.lazer.quote_feed_id
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
        await asyncio.gather(*(self.subscribe_single(router_url) for router_url in self.lazer_urls))

    @retry(
        retry=retry_if_exception_type((StaleConnection, websockets.ConnectionClosed)),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def subscribe_single(self, router_url):
        return await self.subscribe_single_inner(router_url)

    async def subscribe_single_inner(self, router_url):
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        async with websockets.connect(router_url, additional_headers=headers) as ws:
            subscribe_request = self.get_subscribe_request(1)

            await ws.send(json.dumps(subscribe_request))
            logger.info("Sent Lazer subscribe request to {}", router_url)

            # listen for updates
            while True:
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=STALE_TIMEOUT_SECONDS)
                    data = json.loads(message)
                    self.parse_lazer_message(data)
                except asyncio.TimeoutError:
                    raise StaleConnection(f"No messages in {STALE_TIMEOUT_SECONDS} seconds, reconnecting")
                except websockets.ConnectionClosed:
                    raise
                except json.JSONDecodeError as e:
                    logger.error("Failed to decode JSON message: {}", e)
                except Exception as e:
                    logger.error("Unexpected exception: {}", e)

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
            now = time.time()
            for feed_update in price_feeds:
                feed_id = feed_update.get("priceFeedId", None)
                price = feed_update.get("price", None)
                if feed_id is None or price is None:
                    continue
                if feed_id == self.base_feed_id:
                    self.price_state.lazer_base_price = PriceUpdate(price, now)
                if feed_id == self.quote_feed_id:
                    self.price_state.lazer_quote_price = PriceUpdate(price, now)
        except Exception as e:
            logger.error("parse_lazer_message error: {}", e)
