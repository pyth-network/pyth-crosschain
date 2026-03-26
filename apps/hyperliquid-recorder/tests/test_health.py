from __future__ import annotations

import time

from hyperliquid_recorder.health import HealthState


def test_health_requires_clickhouse_and_market_freshness() -> None:
    state = HealthState(expected_coins=("BTC", "ETH"), stale_seconds=30)
    assert not state.is_ready()

    state.set_clickhouse_ok(True)
    assert not state.is_ready()

    state.set_market_seen("BTC")
    state.set_market_seen("ETH")
    assert state.is_ready()


def test_health_becomes_unready_when_market_stale() -> None:
    state = HealthState(expected_coins=("BTC",), stale_seconds=0)
    state.set_clickhouse_ok(True)
    state.set_market_seen("BTC")
    time.sleep(0.01)
    assert not state.is_ready()
