"""
SEDA oracle HTTP polling listener.

SEDA provides custom oracle feeds via HTTP polling (not WebSocket).
Used for specialized feeds not available through Pyth, such as:
- Traditional finance assets with trading sessions
- Custom composite indices
- Assets requiring specific data transformations

DATA SOURCES PROVIDED:
- seda: Primary oracle price (from price_field)
- seda_last: Previous/last session price (from last_price_field)
- seda_ema: EMA price for mark calculations (from session_mark_px_ema_field)

SESSION-AWARE PRICING:
SEDA feeds can include a session_flag field indicating market hours:
- session_flag=true: Market is CLOSED (off hours)
- session_flag=false: Market is OPEN (trading hours)

This enables session_ema source type to return different mark prices
during vs outside trading sessions (e.g., for equity index perpetuals).
"""

import asyncio
import datetime
import json
from pathlib import Path
from typing import Any, TypedDict

import httpx
from loguru import logger

from pusher.config import Config, SedaFeedConfig
from pusher.price_state import PriceSourceState, PriceUpdate


class PollResult(TypedDict, total=False):
    ok: bool
    status: int | None
    json: dict[str, Any]
    error: str


class SedaListener:
    """
    Poll SEDA HTTP API for custom oracle feeds.

    Unlike Lazer/Hermes (WebSocket), SEDA uses HTTP polling.
    Each configured feed is polled independently in parallel.

    MULTI-STATE STORAGE:
    A single SEDA response can populate multiple price states:
    - seda_state: Primary price (always populated)
    - seda_last_state: Last/previous price (if last_price_field configured)
    - seda_ema_state: EMA price (if session_mark_px_ema_field configured)

    This allows session_ema source type to access both oracle and EMA
    prices from the same SEDA feed.
    """

    SOURCE_NAME = "seda"

    def __init__(
        self,
        config: Config,
        seda_state: PriceSourceState,
        seda_last_state: PriceSourceState,
        seda_ema_state: PriceSourceState,
        api_key_override: str | None = None,
    ) -> None:
        self.url = config.seda.url
        self.api_key = api_key_override or (
            Path(config.seda.api_key_path).read_text().strip()
            if config.seda.api_key_path
            else None
        )
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

    def get_request_headers(self) -> dict[str, str]:
        """Build HTTP request headers for SEDA API."""
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def get_request_params(self) -> dict[str, str]:
        """Build HTTP request query parameters for SEDA API."""
        return {
            "encoding": "json",
            "injectLastResult": "success",
        }

    def get_request_data(self, feed_config: SedaFeedConfig) -> dict[str, Any]:
        """Build HTTP request body for a specific feed."""
        return {
            "execProgramId": feed_config.exec_program_id,
            "execInputs": json.loads(feed_config.exec_inputs),
        }

    async def run(self) -> None:
        if not self.feeds:
            logger.info("No SEDA feeds needed")
            return

        async with httpx.AsyncClient(timeout=self.poll_timeout) as client:
            await asyncio.gather(
                *[
                    self._run_single(client, feed_name, self.feeds[feed_name])
                    for feed_name in self.feeds
                ]
            )

    async def _run_single(
        self, client: httpx.AsyncClient, feed_name: str, feed_config: SedaFeedConfig
    ) -> None:
        """Run continuous polling loop for a single feed."""
        while True:
            result = await self.poll_single_feed(client, feed_name, feed_config)
            await asyncio.sleep(
                self.poll_interval if result["ok"] else self.poll_failure_interval
            )

    async def poll_single_feed(
        self,
        client: httpx.AsyncClient,
        feed_name: str,
        feed_config: SedaFeedConfig,
    ) -> PollResult:
        """
        Poll a single SEDA feed once and parse the result.

        This method can be reused by validation scripts for one-shot polling.

        Args:
            client: HTTP client to use for the request
            feed_name: Name of the feed being polled
            feed_config: Configuration for the feed

        Returns:
            PollResult with ok=True if successful, containing the parsed data
        """
        headers = self.get_request_headers()
        params = self.get_request_params()
        data = self.get_request_data(feed_config)

        result = await self._poll(client, headers, params, data)
        if result["ok"]:
            json_data = result.get("json")
            if json_data is not None:
                self._parse_seda_message(feed_name, json_data)
        else:
            logger.error("SEDA poll request for {} failed: {}", feed_name, result)

        return result

    async def _poll(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        params: dict[str, str],
        data: dict[str, Any],
    ) -> PollResult:
        """Execute HTTP POST request to SEDA API."""
        resp: httpx.Response | None = None
        try:
            resp = await client.post(
                self.url, headers=headers, params=params, json=data
            )
            resp.raise_for_status()
            return {"ok": True, "status": resp.status_code, "json": resp.json()}
        except httpx.HTTPStatusError as e:
            return {"ok": False, "status": e.response.status_code, "error": repr(e)}
        except Exception as e:
            return {"ok": False, "status": None, "error": repr(e)}
        finally:
            if resp is not None:
                await resp.aclose()

    def _parse_seda_message(self, feed_name: str, message: dict[str, Any]) -> None:
        """Parse SEDA response and store prices in state."""
        result = message["data"]["result"]

        price = result[self.price_field]
        timestamp = datetime.datetime.fromisoformat(
            result[self.timestamp_field]
        ).timestamp()
        session_flag = (
            result[self.session_flag_field] if self.session_flag_field else False
        )

        logger.debug(
            "Parsed SEDA update for feed: {} price: {} timestamp: {} session_flag: {}",
            feed_name,
            price,
            timestamp,
            session_flag,
        )
        self.seda_state.put(feed_name, PriceUpdate(price, timestamp, session_flag))

        if self.last_price_field:
            last_price = result.get(self.last_price_field)
            logger.debug("SEDA feed: {} last_price: {}", feed_name, last_price)
            self.seda_last_state.put(
                feed_name, PriceUpdate(last_price, timestamp, session_flag)
            )

        if self.session_mark_px_ema_field:
            ema_price = result.get(self.session_mark_px_ema_field)
            logger.debug("SEDA feed: {} session_ema_price: {}", feed_name, ema_price)
            self.seda_ema_state.put(
                feed_name, PriceUpdate(ema_price, timestamp, session_flag)
            )

    def get_parsed_result(self, feed_name: str) -> dict[str, Any] | None:
        """
        Get parsed result for a feed from state.

        Returns a dict with price, timestamp, session_flag, last_price, ema_price.
        Useful for validation/dry-run to report what was parsed.
        """
        update = self.seda_state.get(feed_name)
        if update is None:
            return None

        result: dict[str, Any] = {
            "price": update.price,
            "timestamp": update.timestamp,
            "session_flag": update.session_flag,
        }

        last_update = self.seda_last_state.get(feed_name)
        if last_update is not None:
            result["last_price"] = last_update.price

        ema_update = self.seda_ema_state.get(feed_name)
        if ema_update is not None:
            result["ema_price"] = ema_update.price

        return result
