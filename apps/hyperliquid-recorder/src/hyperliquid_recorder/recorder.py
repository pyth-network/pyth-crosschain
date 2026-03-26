from __future__ import annotations

import queue
import threading
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING

from loguru import logger

from hyperliquid_recorder.stream_client import StreamWorker

if TYPE_CHECKING:
    from collections.abc import Callable

    from hyperliquid_recorder.clickhouse import ClickHouseBatchWriter
    from hyperliquid_recorder.health import HealthState
    from hyperliquid_recorder.metrics import RecorderMetrics
    from hyperliquid_recorder.models import L2Snapshot, MarketSubscription


@dataclass(frozen=True)
class WriterRuntimeConfig:
    batch_max_rows: int
    batch_flush_seconds: float
    queue_max_rows: int


class RecorderRuntime:
    def __init__(
        self,
        endpoint: str,
        auth_token: str,
        markets: tuple[MarketSubscription, ...],
        writer: ClickHouseBatchWriter,
        writer_config: WriterRuntimeConfig,
        metrics: RecorderMetrics,
        health: HealthState,
        reconnect_max_backoff_seconds: int,
        clickhouse_ping: Callable[[], bool],
    ) -> None:
        self._endpoint = endpoint
        self._auth_token = auth_token
        self._markets = markets
        self._writer = writer
        self._writer_config = writer_config
        self._metrics = metrics
        self._health = health
        self._reconnect_max_backoff_seconds = reconnect_max_backoff_seconds
        self._clickhouse_ping = clickhouse_ping

        self._stop_event = threading.Event()
        self._queue: queue.Queue[L2Snapshot] = queue.Queue(maxsize=writer_config.queue_max_rows)
        self._threads: list[threading.Thread] = []

    def start(self) -> None:
        writer_thread = threading.Thread(target=self._writer_loop, daemon=True)
        writer_thread.start()
        self._threads.append(writer_thread)

        for market in self._markets:
            def on_reconnect(reason: str, *, coin: str = market.coin) -> None:
                self._metrics.stream_reconnects.labels(coin, reason).inc()

            def on_error(code: str, *, coin: str = market.coin) -> None:
                self._metrics.stream_errors.labels(coin, code).inc()

            worker = StreamWorker(
                endpoint=self._endpoint,
                auth_token=self._auth_token,
                market=market,
                max_backoff_seconds=self._reconnect_max_backoff_seconds,
                on_snapshot=self._on_snapshot,
                on_reconnect=on_reconnect,
                on_error=on_error,
                should_stop=self._stop_event.is_set,
            )
            thread = threading.Thread(target=worker.run_forever, daemon=True)
            thread.start()
            self._threads.append(thread)

        health_thread = threading.Thread(target=self._health_probe_loop, daemon=True)
        health_thread.start()
        self._threads.append(health_thread)

    def wait_forever(self) -> None:
        while not self._stop_event.is_set():
            time.sleep(1)

    def stop(self) -> None:
        self._stop_event.set()
        for thread in self._threads:
            thread.join(timeout=5)

    def _on_snapshot(self, snapshot: L2Snapshot) -> None:
        self._metrics.record_snapshot(snapshot)
        self._health.set_market_seen(snapshot.coin)
        try:
            self._queue.put(snapshot, timeout=1)
            self._update_queue_metrics()
        except queue.Full:
            self._metrics.queue_drops.labels(snapshot.coin).inc()

    def _update_queue_metrics(self) -> None:
        size = self._queue.qsize()
        self._metrics.queue_depth.set(size)
        self._metrics.queue_fill_ratio.set(size / self._writer_config.queue_max_rows)

    def _writer_loop(self) -> None:
        dedupe: dict[tuple[str, int, int, int, int], L2Snapshot] = {}
        last_flush = time.monotonic()

        while not self._stop_event.is_set():
            timeout = max(0.1, self._writer_config.batch_flush_seconds - (time.monotonic() - last_flush))
            try:
                snapshot = self._queue.get(timeout=timeout)
                dedupe[snapshot.dedupe_key()] = snapshot
                self._update_queue_metrics()
            except queue.Empty:
                pass

            should_flush = (
                len(dedupe) >= self._writer_config.batch_max_rows
                or (dedupe and (time.monotonic() - last_flush) >= self._writer_config.batch_flush_seconds)
            )
            if should_flush:
                self._flush(dedupe)
                dedupe = {}
                last_flush = time.monotonic()

        if dedupe:
            self._flush(dedupe)

    def _flush(self, dedupe: dict[tuple[str, int, int, int, int], L2Snapshot]) -> None:
        batch = list(dedupe.values())
        if not batch:
            return
        while not self._stop_event.is_set():
            try:
                rows, latency = self._writer.insert_batch(batch)
                self._metrics.insert_attempts.labels("success").inc()
                self._metrics.insert_rows.inc(rows)
                self._metrics.insert_latency_seconds.observe(latency)
                logger.info("inserted {} rows into ClickHouse", rows)
                return
            except Exception as exc:
                self._metrics.insert_attempts.labels("error").inc()
                logger.exception("failed to insert batch of {} rows: {}", len(batch), repr(exc))
                time.sleep(1)

    def _health_probe_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                healthy = self._clickhouse_ping()
            except Exception:
                healthy = False
            self._health.set_clickhouse_ok(healthy)
            self._metrics.clickhouse_up.set(1 if healthy else 0)
            ready = self._health.is_ready()
            self._metrics.ready_state.set(1 if ready else 0)
            time.sleep(5)
