import asyncio
import json
from typing import Any

import websockets
from loguru import logger
from tenacity import retry, retry_if_exception_type, wait_fixed
from websockets import ClientConnection

from pusher.config import STALE_TIMEOUT_SECONDS, Config
from pusher.exception import StaleConnectionError
from pusher.price_state import PriceSourceState, PriceUpdate


class LazerListener:
    """
    Subscribe to Lazer price updates for needed feeds.
    """

    def __init__(self, config: Config, lazer_state: PriceSourceState) -> None:
        self.lazer_urls = config.lazer.lazer_urls
        self.api_key = config.lazer.lazer_api_key
        self.feed_ids = config.lazer.feed_ids
        self.lazer_state = lazer_state
        self.stop_after_attempt = config.lazer.stop_after_attempt

    def get_subscribe_request(self, subscription_id: int) -> dict[str, Any]:
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

    def get_auth_headers(self) -> dict[str, str]:
        """Get authorization headers for WebSocket connection."""
        return {"Authorization": f"Bearer {self.api_key}"}

    async def subscribe_all(self) -> None:
        if not self.feed_ids:
            logger.info("No Lazer subscriptions needed")
            return

        await asyncio.gather(
            *(self.subscribe_single(router_url) for router_url in self.lazer_urls)
        )

    async def subscribe_single(self, router_url: str) -> None:
        logger.info("Starting Lazer listener loop: {}", router_url)

        @retry(
            retry=retry_if_exception_type(Exception),
            wait=wait_fixed(1),
            # For now, disable stop_after_attempt to avoid killing process.
            # stop=stop_after_attempt(self.stop_after_attempt),
            reraise=True,
        )
        async def _run() -> None:
            return await self.subscribe_single_inner(router_url)

        return await _run()

    async def subscribe_single_inner(self, router_url: str) -> None:
        headers = self.get_auth_headers()

        async with websockets.connect(router_url, additional_headers=headers) as ws:
            await self.send_subscribe(ws, router_url)

            # listen for updates
            while True:
                await self.receive_and_parse_message(ws, STALE_TIMEOUT_SECONDS)

    async def send_subscribe(self, ws: ClientConnection, url: str) -> None:
        """Send subscribe request to WebSocket."""
        subscribe_request = self.get_subscribe_request(1)
        await ws.send(json.dumps(subscribe_request))
        logger.info(
            "Sent Lazer subscribe request to {} feed_ids {}",
            url,
            self.feed_ids,
        )

    async def receive_and_parse_message(
        self, ws: ClientConnection, timeout: float
    ) -> bool:
        """
        Receive a single message from WebSocket and parse it.

        Args:
            ws: WebSocket connection
            timeout: Timeout in seconds for receiving a message

        Returns:
            True if a message was received and parsed successfully

        Raises:
            StaleConnectionError: If no message received within timeout
            websockets.ConnectionClosed: If connection was closed
        """
        try:
            message = await asyncio.wait_for(ws.recv(), timeout=timeout)
            data = json.loads(message)
            self.parse_lazer_message(data)
            return True
        except TimeoutError:
            logger.warning(
                "LazerListener: No messages in {} seconds, reconnecting...",
                timeout,
            )
            raise StaleConnectionError(
                f"No messages in {timeout} seconds, reconnecting"
            ) from None
        except websockets.ConnectionClosed:
            logger.warning("LazerListener: Connection closed, reconnecting...")
            raise
        except json.JSONDecodeError as e:
            logger.exception("Failed to decode JSON message: {}", repr(e))
            return False
        except Exception as e:
            logger.exception("Unexpected exception: {}", repr(e))
            return False

    def parse_lazer_message(self, data: dict[str, Any]) -> None:
        """
        Parse a Lazer price update message and store in price_state.

        :param data: Lazer price update json message
        :return: None (update lazer_state)
        """
        try:
            if data.get("type", "") != "streamUpdated":
                return
            price_feeds = data["parsed"]["priceFeeds"]
            # timestampUs is in micros, this is scaled to unix seconds the same as time.time()
            timestamp_seconds = int(data["parsed"]["timestampUs"]) / 1_000_000.0
            logger.debug(
                "price_feeds: {} timestamp: {}", price_feeds, timestamp_seconds
            )
            for feed_update in price_feeds:
                feed_id = feed_update.get("priceFeedId")
                price = feed_update.get("price")
                if feed_id is not None and price is not None:
                    self.lazer_state.put(feed_id, PriceUpdate(price, timestamp_seconds))
        except Exception as e:
            logger.exception("parse_lazer_message error: {}", repr(e))
