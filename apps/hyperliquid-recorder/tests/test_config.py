from __future__ import annotations

import os

from hyperliquid_recorder.config import AppConfig


def test_config_parses_market_json(monkeypatch) -> None:
    monkeypatch.setenv("QUICKNODE_GRPC_ENDPOINT", "example:10000")
    monkeypatch.setenv("QUICKNODE_GRPC_AUTH_TOKEN", "token")
    monkeypatch.setenv(
        "HYPERLIQUID_MARKETS_JSON",
        '[{"coin":"BTC","n_levels":20},{"coin":"@142","n_levels":10,"n_sig_figs":3,"mantissa":1}]',
    )
    monkeypatch.setenv("USE_LOCAL_CLICKHOUSE", "true")
    monkeypatch.setenv("CLICKHOUSE_LOCAL_URL", "http://127.0.0.1:8123")
    monkeypatch.setenv("CLICKHOUSE_LOCAL_USER", "default")
    monkeypatch.setenv("CLICKHOUSE_LOCAL_PASSWORD", "")

    config = AppConfig.from_env()
    assert len(config.markets) == 2
    assert config.markets[0].coin == "BTC"
    assert config.markets[1].coin == "@142"
    assert config.markets[1].n_sig_figs == 3
    assert config.markets[1].mantissa == 1

    for key in [
        "QUICKNODE_GRPC_ENDPOINT",
        "QUICKNODE_GRPC_AUTH_TOKEN",
        "HYPERLIQUID_MARKETS_JSON",
        "USE_LOCAL_CLICKHOUSE",
        "CLICKHOUSE_LOCAL_URL",
        "CLICKHOUSE_LOCAL_USER",
        "CLICKHOUSE_LOCAL_PASSWORD",
    ]:
        os.environ.pop(key, None)
