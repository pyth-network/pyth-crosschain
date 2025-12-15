import asyncio
import json
from loguru import logger
import websockets
from tenacity import retry, retry_if_exception_type, wait_fixed, stop_after_attempt

from pusher.config import Config, STALE_TIMEOUT_SECONDS
from pusher.exception import StaleConnectionError
from pusher.price_state import PriceSourceState, PriceUpdate


class LazerListener:
    """
    Subscribe to Lazer price updates for needed feeds.
    """
    def __init__(self, config: Config, lazer_state: PriceSourceState):
        self.lazer_urls = config.lazer.lazer_urls
        self.api_key = config.lazer.lazer_api_key
        self.feed_ids = config.lazer.feed_ids
        self.lazer_state = lazer_state
        self.stop_after_attempt = config.lazer.stop_after_attempt

    def get_subscribe_request(self, subscription_id: int):
        return {
            "type": "subscribe",
            "subscriptionId": subscription_id,
            "priceFeedIds": self.feed_ids,
            "properties": ["price"],
            "formats": [],
            "deliveryFormat": "json",
            "channel": "fixed_rate@200ms",
            "parsed": True,
            "jsonBinaryEncoding": "base64",
        }

    async def subscribe_all(self):
        if not self.feed_ids:
            logger.info("No Lazer subscriptions needed")
            return

        await asyncio.gather(*(self.subscribe_single(router_url) for router_url in self.lazer_urls))

    async def subscribe_single(self, router_url):
        logger.info("Starting Lazer listener loop: {}", router_url)

        @retry(
            retry=retry_if_exception_type(Exception),
            wait=wait_fixed(1),
            stop=stop_after_attempt(self.stop_after_attempt),
            reraise=True,
        )
        async def _run():
            return await self.subscribe_single_inner(router_url)

        return await _run()

    async def subscribe_single_inner(self, router_url):
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        async with websockets.connect(router_url, additional_headers=headers) as ws:
            subscribe_request = self.get_subscribe_request(1)

            await ws.send(json.dumps(subscribe_request))
            logger.info("Sent Lazer subscribe request to {} feed_ids {}", router_url, self.feed_ids)

            # listen for updates
            while True:
                try:
                    message = await asyncio.wait_for(ws.recv(), timeout=STALE_TIMEOUT_SECONDS)
                    data = json.loads(message)
                    self.parse_lazer_message(data)
                except asyncio.TimeoutError:
                    logger.warning("LazerListener: No messages in {} seconds, reconnecting...", STALE_TIMEOUT_SECONDS)
                    raise StaleConnectionError(f"No messages in {STALE_TIMEOUT_SECONDS} seconds, reconnecting")
                except websockets.ConnectionClosed:
                    logger.warning("LazerListener: Connection closed, reconnecting...")
                    raise
                except json.JSONDecodeError as e:
                    logger.exception("Failed to decode JSON message: {}", repr(e))
                except Exception as e:
                    logger.exception("Unexpected exception: {}", repr(e))

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
            # timestampUs is in micros, this is scaled to unix seconds the same as time.time()
            timestamp_seconds = int(data["parsed"]["timestampUs"]) / 1_000_000.0
            logger.debug("price_feeds: {} timestamp: {}", price_feeds, timestamp_seconds)
            for feed_update in price_feeds:
                feed_id = feed_update.get("priceFeedId", None)
                price = feed_update.get("price", None)
                if feed_id is None or price is None:
                    continue
                else:
                    self.lazer_state.put(feed_id, PriceUpdate(price, timestamp_seconds))
        except Exception as e:
            logger.exception("parse_lazer_message error: {}", repr(e))
