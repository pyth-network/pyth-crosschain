from __future__ import annotations

import signal
import sys
import time
from typing import TYPE_CHECKING

from loguru import logger

from hyperliquid_recorder.clickhouse import (
    ClickHouseBatchWriter,
    create_client,
    ensure_schema,
)
from hyperliquid_recorder.config import AppConfig, ConfigError
from hyperliquid_recorder.health import HealthState, start_http_servers
from hyperliquid_recorder.metrics import RecorderMetrics
from hyperliquid_recorder.recorder import RecorderRuntime, WriterRuntimeConfig

if TYPE_CHECKING:
    from clickhouse_connect.driver.client import Client


def _init_logging() -> None:
    logger.remove()
    logger.add(sys.stderr, level="INFO", serialize=False)


def main() -> int:
    _init_logging()
    try:
        config = AppConfig.from_env()
    except ConfigError as exc:
        logger.error("configuration error: {}", str(exc))
        return 1

    writer_client = _create_client_with_retry(config, max_attempts=30)
    if writer_client is None:
        logger.error("failed to connect to ClickHouse after startup retries")
        return 1
    ensure_schema(writer_client, config.clickhouse, config.retention_days)

    ping_client = _create_client_with_retry(config, max_attempts=30)
    if ping_client is None:
        logger.error("failed to create ClickHouse health client after startup retries")
        return 1

    metrics = RecorderMetrics()
    health = HealthState(
        expected_coins=tuple(market.coin for market in config.markets),
        stale_seconds=config.ready_stale_seconds,
    )
    start_http_servers(
        health_port=config.health_port,
        metrics_port=config.metrics_port,
        metrics=metrics,
        state=health,
    )

    runtime = RecorderRuntime(
        endpoint=config.quicknode_endpoint,
        auth_token=config.quicknode_auth_token,
        markets=config.markets,
        writer=ClickHouseBatchWriter(
            client=writer_client,
            target=config.clickhouse,
            insert_async=config.insert_async,
        ),
        writer_config=WriterRuntimeConfig(
            batch_max_rows=config.batch_max_rows,
            batch_flush_seconds=config.batch_flush_seconds,
            queue_max_rows=config.queue_max_rows,
        ),
        metrics=metrics,
        health=health,
        reconnect_max_backoff_seconds=config.reconnect_max_backoff_seconds,
        clickhouse_ping=lambda: ping_client.command("SELECT 1") == 1,
    )
    runtime.start()

    def _shutdown(_signum: int, _frame: object) -> None:
        logger.info("shutdown signal received")
        runtime.stop()

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    runtime.wait_forever()
    return 0


def _create_client_with_retry(config: AppConfig, max_attempts: int) -> Client | None:
    for attempt in range(1, max_attempts + 1):
        try:
            return create_client(config.clickhouse)
        except Exception as exc:
            logger.warning(
                "clickhouse connection attempt {}/{} failed: {}",
                attempt,
                max_attempts,
                repr(exc),
            )
            time.sleep(1)
    return None


if __name__ == "__main__":
    raise SystemExit(main())
