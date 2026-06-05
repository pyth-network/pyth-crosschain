import asyncio
from typing import Any

from pusher.config import Config, HyperliquidConfig, SedaConfig, SedaFeedConfig
from pusher.price_state import PriceSourceState
from pusher.seda_listener import PollResult, SedaListener


class _FakeCounter:
    def __init__(self) -> None:
        self.calls: list[dict[str, str]] = []

    def add(self, amount: int, labels: dict[str, str]) -> None:
        self.calls.append(labels)


class _FakeGauge:
    def __init__(self) -> None:
        self.calls: list[dict[str, str]] = []

    def set(self, value: int, labels: dict[str, str]) -> None:
        self.calls.append(labels)


class _FakeMetrics:
    def __init__(self) -> None:
        self.seda_poll_total = _FakeCounter()
        self.seda_last_success_time = _FakeGauge()


def _seda_listener(metrics: Any) -> SedaListener:
    config: Config = Config.model_construct()
    config.hyperliquid = HyperliquidConfig.model_construct(market_name="pyth")
    config.seda = SedaConfig.model_construct(
        url="https://seda.example",
        api_key_path=None,
        poll_interval=2,
        poll_failure_interval=1,
        poll_timeout=3,
        feeds={},
        price_field="price",
        timestamp_field="timestamp",
        session_flag_field=None,
        last_price_field=None,
        session_mark_px_ema_field=None,
    )
    return SedaListener(
        config,
        PriceSourceState("seda"),
        PriceSourceState("seda_last"),
        PriceSourceState("seda_ema"),
        PriceSourceState("seda_oracle"),
        PriceSourceState("seda_mark"),
        PriceSourceState("seda_external"),
        api_key_override="token",
        metrics=metrics,
    )


def _stub_poll(result: PollResult) -> Any:
    async def _poll(*_args: Any, **_kwargs: Any) -> PollResult:
        return result

    return _poll


_FEED = SedaFeedConfig.model_construct(exec_program_id="x", exec_inputs="{}")


def test_seda_parse_error_returns_failure_and_does_not_raise() -> None:
    """A malformed SEDA body must be treated as a poll failure, not crash."""
    metrics = _FakeMetrics()
    listener = _seda_listener(metrics)
    # HTTP-OK response but an unparseable body (missing data/result).
    listener._poll = _stub_poll({"ok": True, "status": 200, "json": {"bad": "shape"}})

    result = asyncio.run(listener.poll_single_feed(None, "VXX", _FEED))

    assert result["ok"] is False
    assert "parse error" in result["error"]
    assert {
        "dex": "pyth",
        "feed": "VXX",
        "status": "parse_error",
    } in metrics.seda_poll_total.calls
    assert metrics.seda_last_success_time.calls == []


def test_seda_poll_success_records_metrics() -> None:
    metrics = _FakeMetrics()
    listener = _seda_listener(metrics)
    listener._poll = _stub_poll(
        {
            "ok": True,
            "status": 200,
            "json": {
                "data": {"result": {"price": 100.0, "timestamp": "2024-01-01T00:00:00"}}
            },
        }
    )

    result = asyncio.run(listener.poll_single_feed(None, "VXX", _FEED))

    assert result["ok"] is True
    assert {
        "dex": "pyth",
        "feed": "VXX",
        "status": "success",
    } in metrics.seda_poll_total.calls
    assert {"dex": "pyth", "feed": "VXX"} in metrics.seda_last_success_time.calls
