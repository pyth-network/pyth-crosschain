import asyncio
import datetime
from typing import Any

import httpx
import json
from loguru import logger
from pathlib import Path

from pusher.config import Config, SedaFeedConfig
from pusher.price_state import PriceSourceState, PriceUpdate


class SedaListener:
    SOURCE_NAME = "seda"

    """
    Subscribe to SEDA price updates for needed feeds.
    """
    def __init__(self, config: Config, seda_state: PriceSourceState, seda_last_state: PriceSourceState, seda_ema_state: PriceSourceState):
        self.url = config.seda.url
        self.api_key = Path(config.seda.api_key_path).read_text().strip() if config.seda.api_key_path else None
        self.feeds = config.seda.feeds
        self.poll_interval = config.seda.poll_interval
        self.poll_failure_interval = config.seda.poll_failure_interval
        self.poll_timeout = config.seda.poll_timeout
        self.seda_state = seda_state
        self.seda_last_state = seda_last_state
        self.seda_ema_state = seda_ema_state

        self.price_field = config.seda.price_field
        self.timestamp_field = config.seda.timestamp_field
        self.session_flag_field = config.seda.session_flag_field
        self.last_price_field = config.seda.last_price_field
        self.session_mark_px_ema_field = config.seda.session_mark_px_ema_field

    async def run(self):
        if not self.feeds:
            logger.info("No SEDA feeds needed")
            return

        await asyncio.gather(*[self._run_single(feed_name, self.feeds[feed_name]) for feed_name in self.feeds])

    async def _run_single(self, feed_name: str, feed_config: SedaFeedConfig) -> None:
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        params = {
            "encoding": "json",
            "injectLastResult": "success",
        }
        data = {
            "execProgramId": feed_config.exec_program_id,
            "execInputs": json.loads(feed_config.exec_inputs),
        }
        async with httpx.AsyncClient(timeout=self.poll_timeout) as client:
            while True:
                result = await self._poll(client, headers, params, data)
                if result["ok"]:
                    self._parse_seda_message(feed_name, result["json"])
                else:
                    logger.error("SEDA poll request for {} failed: {}", feed_name, result)

                await asyncio.sleep(self.poll_interval if result.get("ok") else self.poll_failure_interval)

    async def _poll(self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        params: dict[str, str],
        data: dict[str, Any],
    ) -> dict:
        try:
            resp = await client.post(self.url, headers=headers, params=params, json=data)
            resp.raise_for_status()
            return {"ok": True, "status": resp.status_code, "json": resp.json()}
        except httpx.HTTPStatusError as e:
            return {"ok": False, "status": e.response.status_code, "error": repr(e)}
        except Exception as e:
            return {"ok": False, "status": None, "error": repr(e)}

    def _parse_seda_message(self, feed_name, message):
        result = message["data"]["result"]

        price = result[self.price_field]
        timestamp = datetime.datetime.fromisoformat(result[self.timestamp_field]).timestamp()
        if self.session_flag_field:
            session_flag = result[self.session_flag_field]
        else:
            session_flag = False

        logger.debug("Parsed SEDA update for feed: {} price: {} timestamp: {} session_flag: {}", feed_name, price, timestamp, session_flag)
        self.seda_state.put(feed_name, PriceUpdate(price, timestamp, session_flag))

        if self.last_price_field:
            last_price = result.get(self.last_price_field)
            logger.debug("SEDA feed: {} last_price: {}", feed_name, last_price)
            self.seda_last_state.put(feed_name, PriceUpdate(last_price, timestamp, session_flag))

        if self.session_mark_px_ema_field:
            ema_price = result.get(self.session_mark_px_ema_field)
            logger.debug("SEDA feed: {} session_ema_price: {}", feed_name, ema_price)
            self.seda_ema_state.put(feed_name, PriceUpdate(ema_price, timestamp, session_flag))