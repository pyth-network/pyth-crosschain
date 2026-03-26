from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from decimal import Decimal


@dataclass(frozen=True)
class MarketSubscription:
    coin: str
    n_levels: int
    n_sig_figs: int | None = None
    mantissa: int | None = None

    def dedupe_shape(self) -> tuple[str, int, int, int]:
        return (
            self.coin,
            self.n_levels,
            self.n_sig_figs or 0,
            self.mantissa or 0,
        )


@dataclass(frozen=True)
class L2Level:
    px: Decimal
    sz: Decimal
    n: int


@dataclass(frozen=True)
class L2Snapshot:
    coin: str
    block_time_ms: int
    block_number: int
    n_levels: int
    n_sig_figs: int | None
    mantissa: int | None
    source_endpoint: str
    bids: tuple[L2Level, ...]
    asks: tuple[L2Level, ...]

    def dedupe_key(self) -> tuple[str, int, int, int, int]:
        return (
            self.coin,
            self.block_number,
            self.n_levels,
            self.n_sig_figs or 0,
            self.mantissa or 0,
        )
