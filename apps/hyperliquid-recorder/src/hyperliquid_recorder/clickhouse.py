from __future__ import annotations

import datetime as dt
import time
from typing import TYPE_CHECKING

import clickhouse_connect

if TYPE_CHECKING:
    from decimal import Decimal

    from clickhouse_connect.driver.client import Client

    from hyperliquid_recorder.config import ClickHouseTarget
    from hyperliquid_recorder.models import L2Level, L2Snapshot


def create_client(target: ClickHouseTarget) -> Client:
    return clickhouse_connect.get_client(
        host=target.host,
        port=target.port,
        username=target.username,
        password=target.password,
        secure=target.secure,
        database=target.database,
    )


def ensure_schema(client: Client, target: ClickHouseTarget, retention_days: int) -> None:
    client.command(f"CREATE DATABASE IF NOT EXISTS {target.database}")
    client.command(
        f"""
        CREATE TABLE IF NOT EXISTS {target.database}.{target.table}
        (
            coin LowCardinality(String),
            block_time DateTime64(3),
            block_number UInt64,
            n_levels UInt16,
            n_sig_figs UInt8 DEFAULT 0,
            mantissa UInt8 DEFAULT 0,
            source_endpoint LowCardinality(String),
            bids Array(Tuple(Decimal64(12), Decimal64(12), UInt32)),
            asks Array(Tuple(Decimal64(12), Decimal64(12), UInt32)),
            ingested_at DateTime64(3) DEFAULT now64(3)
        )
        ENGINE = ReplacingMergeTree(ingested_at)
        PARTITION BY toYYYYMM(block_time)
        ORDER BY (coin, block_time, block_number, n_levels, n_sig_figs, mantissa)
        TTL toDateTime(block_time) + INTERVAL {retention_days} DAY DELETE
        """
    )


def ping(client: Client) -> bool:
    try:
        client.command("SELECT 1")
        return True
    except Exception:
        return False


def snapshot_to_row(snapshot: L2Snapshot) -> list[object]:
    block_time = dt.datetime.fromtimestamp(snapshot.block_time_ms / 1000, tz=dt.UTC)
    return [
        snapshot.coin,
        block_time,
        snapshot.block_number,
        snapshot.n_levels,
        snapshot.n_sig_figs or 0,
        snapshot.mantissa or 0,
        snapshot.source_endpoint,
        _levels_to_tuples(snapshot.bids),
        _levels_to_tuples(snapshot.asks),
    ]


def _levels_to_tuples(levels: tuple[L2Level, ...]) -> list[tuple[Decimal, Decimal, int]]:
    return [(level.px, level.sz, level.n) for level in levels]


class ClickHouseBatchWriter:
    def __init__(
        self,
        client: Client,
        target: ClickHouseTarget,
        insert_async: bool,
    ) -> None:
        self._client = client
        self._target = target
        self._insert_async = insert_async

    def insert_batch(self, snapshots: list[L2Snapshot]) -> tuple[int, float]:
        start = time.perf_counter()
        rows = [snapshot_to_row(snapshot) for snapshot in snapshots]
        settings = {}
        if self._insert_async:
            settings["async_insert"] = 1
            settings["wait_for_async_insert"] = 1
        self._client.insert(
            f"{self._target.database}.{self._target.table}",
            rows,
            column_names=[
                "coin",
                "block_time",
                "block_number",
                "n_levels",
                "n_sig_figs",
                "mantissa",
                "source_endpoint",
                "bids",
                "asks",
            ],
            settings=settings,
        )
        return len(rows), time.perf_counter() - start

    def ping(self) -> bool:
        return ping(self._client)
