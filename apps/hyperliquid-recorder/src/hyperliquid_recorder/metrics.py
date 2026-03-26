from __future__ import annotations

import time
from typing import TYPE_CHECKING

from prometheus_client import REGISTRY, Counter, Gauge, Histogram, generate_latest

if TYPE_CHECKING:
    from hyperliquid_recorder.models import L2Snapshot


class RecorderMetrics:
    def __init__(self) -> None:
        self.stream_messages = Counter(
            "hyperliquid_recorder_stream_messages_total",
            "Total L2 snapshots received from stream",
            labelnames=("coin",),
            registry=REGISTRY,
        )
        self.stream_reconnects = Counter(
            "hyperliquid_recorder_stream_reconnects_total",
            "Total reconnect attempts by market",
            labelnames=("coin", "reason"),
            registry=REGISTRY,
        )
        self.stream_errors = Counter(
            "hyperliquid_recorder_stream_errors_total",
            "Total stream errors by market",
            labelnames=("coin", "code"),
            registry=REGISTRY,
        )
        self.market_last_message_unix_seconds = Gauge(
            "hyperliquid_recorder_market_last_message_unix_seconds",
            "Unix timestamp for last received market message",
            labelnames=("coin",),
            registry=REGISTRY,
        )
        self.market_last_block_number = Gauge(
            "hyperliquid_recorder_market_last_block_number",
            "Last observed block number per market",
            labelnames=("coin",),
            registry=REGISTRY,
        )
        self.market_last_block_time_ms = Gauge(
            "hyperliquid_recorder_market_last_block_time_ms",
            "Last observed block timestamp from stream (milliseconds)",
            labelnames=("coin",),
            registry=REGISTRY,
        )
        self.market_snapshot_levels = Gauge(
            "hyperliquid_recorder_market_snapshot_levels",
            "Snapshot levels observed per side",
            labelnames=("coin", "side"),
            registry=REGISTRY,
        )
        self.queue_depth = Gauge(
            "hyperliquid_recorder_queue_depth",
            "Current in-memory queue depth",
            registry=REGISTRY,
        )
        self.queue_fill_ratio = Gauge(
            "hyperliquid_recorder_queue_fill_ratio",
            "Current in-memory queue fill ratio",
            registry=REGISTRY,
        )
        self.queue_drops = Counter(
            "hyperliquid_recorder_queue_drops_total",
            "Total dropped snapshots due to queue saturation",
            labelnames=("coin",),
            registry=REGISTRY,
        )
        self.insert_attempts = Counter(
            "hyperliquid_recorder_insert_attempts_total",
            "Total ClickHouse insert attempts",
            labelnames=("status",),
            registry=REGISTRY,
        )
        self.insert_rows = Counter(
            "hyperliquid_recorder_insert_rows_total",
            "Total rows inserted into ClickHouse",
            registry=REGISTRY,
        )
        self.insert_latency_seconds = Histogram(
            "hyperliquid_recorder_insert_latency_seconds",
            "ClickHouse insert latency in seconds",
            buckets=(0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10),
            registry=REGISTRY,
        )
        self.clickhouse_up = Gauge(
            "hyperliquid_recorder_clickhouse_up",
            "Whether ClickHouse is currently reachable (1/0)",
            registry=REGISTRY,
        )
        self.ready_state = Gauge(
            "hyperliquid_recorder_ready",
            "Readiness status (1=ready, 0=not ready)",
            registry=REGISTRY,
        )

    def record_snapshot(self, snapshot: L2Snapshot) -> None:
        self.stream_messages.labels(snapshot.coin).inc()
        self.market_last_message_unix_seconds.labels(snapshot.coin).set(time.time())
        self.market_last_block_number.labels(snapshot.coin).set(snapshot.block_number)
        self.market_last_block_time_ms.labels(snapshot.coin).set(snapshot.block_time_ms)
        self.market_snapshot_levels.labels(snapshot.coin, "bids").set(len(snapshot.bids))
        self.market_snapshot_levels.labels(snapshot.coin, "asks").set(len(snapshot.asks))

    def to_prometheus_payload(self) -> bytes:
        return generate_latest(REGISTRY)
