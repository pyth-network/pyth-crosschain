from __future__ import annotations

from decimal import Decimal

from hyperliquid_recorder.models import L2Level, L2Snapshot


def test_snapshot_dedupe_key_uses_request_shape() -> None:
    snapshot = L2Snapshot(
        coin="BTC",
        block_time_ms=1_700_000_000_000,
        block_number=123,
        n_levels=20,
        n_sig_figs=3,
        mantissa=1,
        source_endpoint="endpoint",
        bids=(L2Level(px=Decimal("1.0"), sz=Decimal("2.0"), n=1),),
        asks=(L2Level(px=Decimal("1.1"), sz=Decimal("3.0"), n=2),),
    )
    assert snapshot.dedupe_key() == ("BTC", 123, 20, 3, 1)
