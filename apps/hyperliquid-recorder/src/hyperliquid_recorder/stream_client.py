from __future__ import annotations

import time
from decimal import Decimal
from typing import TYPE_CHECKING, Any

import grpc
from loguru import logger

from hyperliquid_recorder import orderbook_pb2 as _orderbook_pb2
from hyperliquid_recorder import orderbook_pb2_grpc as _orderbook_pb2_grpc
from hyperliquid_recorder.models import L2Level, L2Snapshot, MarketSubscription

orderbook_pb2: Any = _orderbook_pb2
orderbook_pb2_grpc: Any = _orderbook_pb2_grpc

if TYPE_CHECKING:
    from collections.abc import Callable
    from typing import Protocol

    class L2LevelMessage(Protocol):
        px: str
        sz: str
        n: int


class StreamWorker:
    def __init__(
        self,
        endpoint: str,
        auth_token: str,
        market: MarketSubscription,
        max_backoff_seconds: int,
        on_snapshot: Callable[[L2Snapshot], None],
        on_reconnect: Callable[[str], None],
        on_error: Callable[[str], None],
        should_stop: Callable[[], bool],
    ) -> None:
        self._endpoint = endpoint
        self._auth_token = auth_token
        self._market = market
        self._max_backoff_seconds = max_backoff_seconds
        self._on_snapshot = on_snapshot
        self._on_reconnect = on_reconnect
        self._on_error = on_error
        self._should_stop = should_stop

    def run_forever(self) -> None:
        delay_seconds = 1.0
        while not self._should_stop():
            try:
                self._stream_once()
                delay_seconds = 1.0
            except grpc.RpcError as exc:
                code = exc.code().name if exc.code() is not None else "UNKNOWN"
                self._on_error(code)
                self._on_reconnect(code)
                logger.warning(
                    "stream error for coin={} code={} details={}",
                    self._market.coin,
                    code,
                    exc.details(),
                )
                time.sleep(delay_seconds)
                delay_seconds = min(delay_seconds * 2, self._max_backoff_seconds)
            except Exception as exc:
                self._on_error("EXCEPTION")
                self._on_reconnect("EXCEPTION")
                logger.exception(
                    "unexpected stream failure for coin={} error={}",
                    self._market.coin,
                    repr(exc),
                )
                time.sleep(delay_seconds)
                delay_seconds = min(delay_seconds * 2, self._max_backoff_seconds)

    def _stream_once(self) -> None:
        channel = grpc.secure_channel(
            self._endpoint,
            grpc.ssl_channel_credentials(),
            options=[
                ("grpc.max_receive_message_length", 100 * 1024 * 1024),
                ("grpc.keepalive_time_ms", 30000),
            ],
        )
        stub = orderbook_pb2_grpc.OrderBookStreamingStub(channel)
        request = orderbook_pb2.L2BookRequest(
            coin=self._market.coin,
            n_levels=self._market.n_levels,
        )
        if self._market.n_sig_figs is not None:
            request.n_sig_figs = self._market.n_sig_figs
        if self._market.mantissa is not None:
            request.mantissa = self._market.mantissa

        try:
            stream = stub.StreamL2Book(
                request,
                metadata=[("x-token", self._auth_token)],
            )
            for update in stream:
                if self._should_stop():
                    break
                self._on_snapshot(
                    L2Snapshot(
                        coin=update.coin,
                        block_time_ms=int(update.time),
                        block_number=int(update.block_number),
                        n_levels=self._market.n_levels,
                        n_sig_figs=self._market.n_sig_figs,
                        mantissa=self._market.mantissa,
                        source_endpoint=self._endpoint,
                        bids=tuple(_to_level(level) for level in update.bids),
                        asks=tuple(_to_level(level) for level in update.asks),
                    )
                )
        finally:
            channel.close()


def _to_level(level: L2LevelMessage) -> L2Level:
    px = level.px
    sz = level.sz
    n = level.n
    return L2Level(px=Decimal(px), sz=Decimal(sz), n=n)
