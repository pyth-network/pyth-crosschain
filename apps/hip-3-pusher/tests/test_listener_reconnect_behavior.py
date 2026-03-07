import asyncio
import json

import pytest

from pusher.config import Config, HermesConfig, HyperliquidConfig, LazerConfig
from pusher.exception import StaleConnectionError
from pusher.hermes_listener import HermesListener
from pusher.hyperliquid_listener import HyperliquidListener
from pusher.lazer_listener import LazerListener
from pusher.price_state import PriceSourceState


class _InvalidJsonWs:
    async def recv(self) -> str:
        return "{not-json"


class _HyperliquidFakeWs:
    def __init__(self) -> None:
        self.recv_calls = 0

    async def __aenter__(self) -> "_HyperliquidFakeWs":
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: object | None,
    ) -> bool:
        return False

    async def send(self, _message: str) -> None:
        return None

    async def recv(self) -> str:
        self.recv_calls += 1
        if self.recv_calls == 1:
            return json.dumps(
                {
                    "channel": "activeAssetCtx",
                    "data": {
                        "coin": "BTC",
                        "ctx": {"oraclePx": "100.0", "markPx": "99.0"},
                    },
                }
            )
        # If stale detection is swallowed and loop continues, this escapes immediately.
        raise SystemExit("loop continued unexpectedly")


def _minimal_config() -> Config:
    config: Config = Config.model_construct()
    config.lazer = LazerConfig.model_construct(
        lazer_urls=["wss://lazer.example"],
        lazer_api_key="token",
        feed_ids=[1],
        stop_after_attempt=3,
    )
    config.hermes = HermesConfig.model_construct(
        hermes_urls=["wss://hermes.example"],
        feed_ids=["feed-id"],
        stop_after_attempt=3,
    )
    config.hyperliquid = HyperliquidConfig.model_construct(
        hyperliquid_ws_urls=["wss://hyperliquid.example"],
        market_name="pyth",
        asset_context_symbols=["BTC"],
        ws_ping_interval=999999,
        stop_after_attempt=3,
    )
    return config


def test_lazer_json_decode_error_triggers_reconnect() -> None:
    listener = LazerListener(_minimal_config(), PriceSourceState("lazer"))
    with pytest.raises(StaleConnectionError, match="decode JSON"):
        asyncio.run(listener.receive_and_parse_message(_InvalidJsonWs(), timeout=1.0))


def test_hermes_json_decode_error_triggers_reconnect() -> None:
    listener = HermesListener(_minimal_config(), PriceSourceState("hermes"))
    with pytest.raises(StaleConnectionError, match="decode JSON"):
        asyncio.run(listener.receive_and_parse_message(_InvalidJsonWs(), timeout=1.0))


def test_hyperliquid_stale_channel_detection_propagates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    listener = HyperliquidListener(
        _minimal_config(),
        PriceSourceState("hl_oracle"),
        PriceSourceState("hl_mark"),
        PriceSourceState("hl_mid"),
    )
    fake_ws = _HyperliquidFakeWs()

    monkeypatch.setattr(
        "pusher.hyperliquid_listener.websockets.connect", lambda _url: fake_ws
    )

    times = iter([0.0, 10.0])
    monkeypatch.setattr("pusher.hyperliquid_listener.time.time", lambda: next(times))

    with pytest.raises(StaleConnectionError, match="No messages in channel"):
        asyncio.run(listener.subscribe_single_inner("wss://hyperliquid.example"))
