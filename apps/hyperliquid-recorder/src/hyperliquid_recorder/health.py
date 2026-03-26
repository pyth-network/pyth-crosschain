from __future__ import annotations

import json
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from hyperliquid_recorder.metrics import RecorderMetrics


class HealthState:
    def __init__(self, expected_coins: tuple[str, ...], stale_seconds: int) -> None:
        self._expected_coins = expected_coins
        self._stale_seconds = stale_seconds
        self._market_last_message: dict[str, float] = {}
        self._clickhouse_ok = False
        self._lock = threading.Lock()

    def set_market_seen(self, coin: str) -> None:
        with self._lock:
            self._market_last_message[coin] = time.time()

    def set_clickhouse_ok(self, healthy: bool) -> None:
        with self._lock:
            self._clickhouse_ok = healthy

    def is_ready(self) -> bool:
        now = time.time()
        with self._lock:
            if not self._clickhouse_ok:
                return False
            for coin in self._expected_coins:
                seen = self._market_last_message.get(coin)
                if seen is None or now - seen > self._stale_seconds:
                    return False
            return True

    def to_dict(self) -> dict[str, object]:
        now = time.time()
        with self._lock:
            stale = []
            for coin in self._expected_coins:
                seen = self._market_last_message.get(coin)
                if seen is None or now - seen > self._stale_seconds:
                    stale.append(coin)
            ready = self._clickhouse_ok and not stale
            return {
                "ready": ready,
                "clickhouse_ok": self._clickhouse_ok,
                "stale_markets": stale,
            }


def start_http_servers(
    health_port: int,
    metrics_port: int,
    metrics: RecorderMetrics,
    state: HealthState,
) -> None:
    class HealthHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path == "/live":
                payload = b'{"status":"live"}'
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return

            if self.path == "/ready":
                ready = state.is_ready()
                body = json.dumps(state.to_dict()).encode("utf-8")
                self.send_response(HTTPStatus.OK if ready else HTTPStatus.SERVICE_UNAVAILABLE)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            self.send_response(HTTPStatus.NOT_FOUND)
            self.end_headers()

        def log_message(self, _format: str, *_args: object) -> None:
            return None

    class MetricsHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.path != "/metrics":
                self.send_response(HTTPStatus.NOT_FOUND)
                self.end_headers()
                return

            payload = metrics.to_prometheus_payload()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/plain; version=0.0.4")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, _format: str, *_args: object) -> None:
            return None

    health_server = ThreadingHTTPServer(("0.0.0.0", health_port), HealthHandler)
    metrics_server = ThreadingHTTPServer(("0.0.0.0", metrics_port), MetricsHandler)

    threading.Thread(target=health_server.serve_forever, daemon=True).start()
    threading.Thread(target=metrics_server.serve_forever, daemon=True).start()
