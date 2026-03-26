from __future__ import annotations

import json
import os
from dataclasses import dataclass
from urllib.parse import urlparse

from pydantic import BaseModel, Field, ValidationError

from hyperliquid_recorder.models import MarketSubscription


class ConfigError(ValueError):
    pass


class MarketInput(BaseModel):
    coin: str
    n_levels: int = Field(default=20, ge=1, le=100)
    n_sig_figs: int | None = Field(default=None, ge=2, le=5)
    mantissa: int | None = Field(default=None, ge=1, le=5)


@dataclass(frozen=True)
class ClickHouseTarget:
    host: str
    port: int
    username: str
    password: str
    secure: bool
    database: str
    table: str


@dataclass(frozen=True)
class AppConfig:
    quicknode_endpoint: str
    quicknode_auth_token: str
    markets: tuple[MarketSubscription, ...]
    clickhouse: ClickHouseTarget
    metrics_port: int
    health_port: int
    ready_stale_seconds: int
    queue_max_rows: int
    batch_max_rows: int
    batch_flush_seconds: float
    retention_days: int
    insert_async: bool
    reconnect_max_backoff_seconds: int

    @staticmethod
    def from_env() -> AppConfig:
        quicknode_endpoint = _require("QUICKNODE_GRPC_ENDPOINT")
        quicknode_auth_token = _require("QUICKNODE_GRPC_AUTH_TOKEN")
        markets = _parse_markets()
        clickhouse = _parse_clickhouse_target()

        return AppConfig(
            quicknode_endpoint=quicknode_endpoint,
            quicknode_auth_token=quicknode_auth_token,
            markets=markets,
            clickhouse=clickhouse,
            metrics_port=int(os.getenv("METRICS_PORT", "9091")),
            health_port=int(os.getenv("HEALTH_PORT", "8080")),
            ready_stale_seconds=int(os.getenv("READY_STALE_SECONDS", "30")),
            queue_max_rows=int(os.getenv("QUEUE_MAX_ROWS", "50000")),
            batch_max_rows=int(os.getenv("BATCH_MAX_ROWS", "10000")),
            batch_flush_seconds=float(os.getenv("BATCH_FLUSH_SECONDS", "2")),
            retention_days=int(os.getenv("RETENTION_DAYS", "90")),
            insert_async=os.getenv("INSERT_ASYNC", "true").lower() == "true",
            reconnect_max_backoff_seconds=int(
                os.getenv("RECONNECT_MAX_BACKOFF_SECONDS", "60")
            ),
        )


def _require(key: str) -> str:
    value = os.getenv(key)
    if value is None or value == "":
        raise ConfigError(f"Missing environment variable: {key}")
    return value


def _parse_markets() -> tuple[MarketSubscription, ...]:
    if raw_json := os.getenv("HYPERLIQUID_MARKETS_JSON"):
        try:
            parsed = json.loads(raw_json)
            if not isinstance(parsed, list):
                raise ConfigError("HYPERLIQUID_MARKETS_JSON must be a JSON list")
            markets = tuple(
                MarketSubscription(**MarketInput.model_validate(item).model_dump())
                for item in parsed
            )
            if not markets:
                raise ConfigError("At least one market is required")
            return markets
        except (json.JSONDecodeError, ValidationError) as exc:
            raise ConfigError(f"Invalid HYPERLIQUID_MARKETS_JSON: {exc}") from exc

    csv = os.getenv("HYPERLIQUID_MARKETS", "BTC")
    markets = tuple(
        MarketSubscription(coin=coin.strip(), n_levels=20)
        for coin in csv.split(",")
        if coin.strip()
    )
    if not markets:
        raise ConfigError("No markets configured")
    return markets


def _parse_clickhouse_target() -> ClickHouseTarget:
    use_local = os.getenv("USE_LOCAL_CLICKHOUSE", "false").lower() == "true"
    url: str | None
    if use_local:
        url = os.getenv("CLICKHOUSE_LOCAL_URL", "http://127.0.0.1:8123")
        username = os.getenv("CLICKHOUSE_LOCAL_USER", "default")
        password = os.getenv("CLICKHOUSE_LOCAL_PASSWORD", "")
    else:
        url = os.getenv("CLICKHOUSE_PYTH_ANALYTICS_URL")
        if not url:
            raise ConfigError(
                "CLICKHOUSE_PYTH_ANALYTICS_URL is required unless USE_LOCAL_CLICKHOUSE=true"
            )
        username = os.getenv("CLICKHOUSE_PYTH_ANALYTICS_USERNAME", "default")
        password = _require("CLICKHOUSE_PYTH_ANALYTICS_PASSWORD")
    assert url is not None

    parsed = urlparse(url)
    if not parsed.hostname or not parsed.port:
        raise ConfigError(f"Invalid ClickHouse URL: {url}")

    return ClickHouseTarget(
        host=parsed.hostname,
        port=parsed.port,
        username=username,
        password=password,
        secure=parsed.scheme == "https",
        database=os.getenv("CLICKHOUSE_DATABASE", "pyth_analytics"),
        table=os.getenv("CLICKHOUSE_TABLE", "hyperliquid_l2_snapshots"),
    )
