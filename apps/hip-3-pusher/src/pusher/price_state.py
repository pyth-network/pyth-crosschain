"""
Price state management and waterfall resolution.

This module maintains the latest prices from all data sources and implements
the waterfall logic for resolving prices during each publish cycle.

WATERFALL LOGIC:
For each symbol, the config defines a prioritized list of price sources.
When computing prices, we try each source in order until we find a VALID
(non-stale) price. A price is stale if older than stale_price_threshold_seconds.

Example waterfall for BTC:
  1. Try hl_oracle BTC      -> if fresh, use it ✓
  2. Try lazer BTC/USDT     -> if fresh, use it ✓
  3. Try hermes BTC/USDT    -> if fresh, use it ✓
  4. All failed             -> no price published

This provides automatic failover when primary sources go down.
"""

import time
from dataclasses import dataclass
from typing import Any

from loguru import logger

from pusher.config import (
    Config,
    ConstantSourceConfig,
    OracleMidAverageConfig,
    PairSourceConfig,
    PriceSource,
    PriceSourceConfig,
    SessionEMASourceConfig,
    SingleSourceConfig,
)

DEFAULT_STALE_PRICE_THRESHOLD_SECONDS = 5


@dataclass
class PriceUpdate:
    """
    A single price update from a data source.

    Attributes:
        price: The price value (string or float depending on source)
        timestamp: Unix timestamp when this price was received
        session_flag: For session-aware sources (SEDA), True = off-market hours
    """

    price: float | str
    timestamp: float
    session_flag: bool = False

    def time_diff(self, now: float) -> float:
        """Calculate how old this price is in seconds."""
        return now - self.timestamp


@dataclass
class OracleUpdate:
    """
    Complete price update for one publish cycle.

    Contains all three price types that Hyperliquid's setOracle API accepts.
    """

    oracle: dict[str, str]  # symbol -> price (required)
    mark: dict[str, str | list[Any]]  # symbol -> price or [price1, price2] (optional)
    external: dict[str, str]  # symbol -> price (optional)


class PriceSourceState:
    """
    In-memory storage for prices from a single data source.

    Each listener (Lazer, Hermes, etc.) writes to its own PriceSourceState.
    Keys are source_id values (symbol strings or numeric feed IDs).
    """

    def __init__(self, name: str) -> None:
        self.name = name
        self.state: dict[str | int, PriceUpdate] = {}

    def __repr__(self) -> str:
        return f"PriceSourceState(name={self.name} state={self.state})"

    def get(self, symbol: str | int) -> PriceUpdate | None:
        return self.state.get(symbol)

    def put(self, symbol: str | int, value: PriceUpdate) -> None:
        self.state[symbol] = value


class PriceState:
    """
    Central price state manager that aggregates all data sources.

    ARCHITECTURE:
    - Each listener writes to its own PriceSourceState via put()
    - Publisher calls get_all_prices() to compute final prices
    - Waterfall logic is applied per-symbol to select the first valid source

    SOURCE NAMES (used in config source_name field):
    - HL_ORACLE: Hyperliquid's oraclePx from activeAssetCtx subscription
    - HL_MARK: Hyperliquid's markPx from activeAssetCtx subscription
    - HL_MID: Hyperliquid's mid price from allMids subscription
    - LAZER: Pyth Lazer WebSocket feed prices
    - HERMES: Pythnet/Hermes WebSocket feed prices
    - SEDA: SEDA HTTP polling primary price
    - SEDA_LAST: SEDA previous/last session price
    - SEDA_EMA: SEDA EMA price for mark calculations
    """

    # Source name constants - these match the source_name values in config
    HL_ORACLE = "hl_oracle"
    HL_MARK = "hl_mark"
    HL_MID = "hl_mid"
    LAZER = "lazer"
    HERMES = "hermes"
    SEDA = "seda"
    SEDA_LAST = "seda_last"
    SEDA_EMA = "seda_ema"
    SEDA_ORACLE = "seda_oracle"
    SEDA_MARK = "seda_mark"
    SEDA_EXTERNAL = "seda_external"

    def __init__(self, config: Config) -> None:
        self.market_name = config.hyperliquid.market_name
        self.stale_price_threshold_seconds = config.stale_price_threshold_seconds
        self.price_config = config.price

        # Initialize state storage for each data source
        # Listeners write to these, publisher reads from them
        self.hl_oracle_state = PriceSourceState(self.HL_ORACLE)
        self.hl_mark_state = PriceSourceState(self.HL_MARK)
        self.hl_mid_state = PriceSourceState(self.HL_MID)
        self.lazer_state = PriceSourceState(self.LAZER)
        self.hermes_state = PriceSourceState(self.HERMES)
        self.seda_state = PriceSourceState(self.SEDA)
        self.seda_last_state = PriceSourceState(self.SEDA_LAST)
        self.seda_ema_state = PriceSourceState(self.SEDA_EMA)
        self.seda_oracle_state = PriceSourceState(self.SEDA_ORACLE)
        self.seda_mark_state = PriceSourceState(self.SEDA_MARK)
        self.seda_external_state = PriceSourceState(self.SEDA_EXTERNAL)

        # Map source names to state objects for dynamic lookup
        self.all_states: dict[str, PriceSourceState] = {
            self.HL_ORACLE: self.hl_oracle_state,
            self.HL_MARK: self.hl_mark_state,
            self.HL_MID: self.hl_mid_state,
            self.LAZER: self.lazer_state,
            self.HERMES: self.hermes_state,
            self.SEDA: self.seda_state,
            self.SEDA_LAST: self.seda_last_state,
            self.SEDA_EMA: self.seda_ema_state,
            self.SEDA_ORACLE: self.seda_oracle_state,
            self.SEDA_MARK: self.seda_mark_state,
            self.SEDA_EXTERNAL: self.seda_external_state,
        }

    def get_all_prices(self) -> OracleUpdate:
        """
        Compute all prices for one publish cycle using waterfall logic.

        IMPORTANT: Order matters! Oracle prices are computed first because
        mark prices (oracle_mid_average) may depend on them.
        """
        logger.debug("get_all_prices state: {}", self.all_states)

        oracle_update = OracleUpdate({}, {}, {})
        # Compute oracle prices FIRST - mark prices may reference them
        oracle_update.oracle = self.get_prices(self.price_config.oracle, oracle_update)
        oracle_update.mark = self.get_prices(self.price_config.mark, oracle_update)
        oracle_update.external = self.get_prices(
            self.price_config.external, oracle_update
        )

        return oracle_update

    def get_prices(
        self,
        symbol_configs: dict[str, list[PriceSourceConfig]],
        oracle_update: OracleUpdate,
    ) -> dict[str, Any]:
        """
        Apply waterfall logic to compute prices for all symbols of one price type.

        WATERFALL: For each symbol, iterate through configured sources in priority
        order and return the first valid (non-stale, non-None) price.

        Args:
            symbol_configs: Map of symbol -> list of source configs (priority order)
            oracle_update: Current oracle prices (needed for oracle_mid_average)

        Returns:
            Dict of "market:symbol" -> price string
        """
        pxs: dict[str, Any] = {}
        for symbol in symbol_configs:
            for source_config in symbol_configs[symbol]:
                try:
                    # WATERFALL: Try each source until we get a valid price
                    px = self.get_price(source_config, oracle_update)
                    if px is not None:
                        # Normalize to string or list of strings for HL API
                        # Numbers come from division/API, strings from raw prices,
                        # lists from session_ema (2 mark prices)
                        if not isinstance(px, str) and not isinstance(px, list):
                            px = str(px)
                        pxs[f"{self.market_name}:{symbol}"] = px
                        break  # Found valid price, stop waterfall
                except Exception as e:
                    logger.exception(
                        "get_price exception for symbol: {} source_config: {} error: {}",
                        symbol,
                        source_config,
                        repr(e),
                    )
        return pxs

    def get_price(
        self,
        price_source_config: PriceSourceConfig,
        oracle_update: OracleUpdate,
    ) -> str | float | list[float | str] | None:
        """
        Get price from a single source config.

        Dispatches to the appropriate handler based on source_type.
        Returns None if the source is invalid/stale (triggers waterfall fallback).
        """
        if isinstance(price_source_config, ConstantSourceConfig):
            # Constants always return their value (no staleness check)
            return str(price_source_config.value)
        elif isinstance(price_source_config, SingleSourceConfig):
            return self.get_price_from_single_source(price_source_config.source)
        elif isinstance(price_source_config, PairSourceConfig):
            return self.get_price_from_pair_source(
                price_source_config.base_source, price_source_config.quote_source
            )
        elif isinstance(price_source_config, OracleMidAverageConfig):
            return self.get_price_from_oracle_mid_average(
                price_source_config.symbol, oracle_update
            )
        elif isinstance(price_source_config, SessionEMASourceConfig):
            return self.get_price_from_session_ema_source(
                price_source_config.oracle_source, price_source_config.ema_source
            )
        else:
            raise ValueError

    def get_price_from_single_source(self, source: PriceSource) -> float | str | None:
        """
        Get price directly from a single data source.

        Performs staleness check and optional exponent scaling.
        Returns None if source is missing, stale, or session_flag doesn't match.

        EXPONENT HANDLING:
        Lazer and Hermes return prices as integers with an exponent.
        Example: raw=6500000000000, exponent=-8 -> actual=65000.00
        Formula: actual_price = raw_price / (10 ^ -exponent)
        """
        now = time.time()
        source_state = self.all_states.get(source.source_name)
        if source_state is None:
            logger.warning("source {} is unknown", source.source_name)
            return None
        update = source_state.get(source.source_id)

        if update is None:
            logger.warning(
                "source {} id {} is missing", source.source_name, source.source_id
            )
            return None

        # SESSION-AWARE SOURCES: Only use when session_flag matches expectation
        # use_session_flag=true means "only use this source during off-hours"
        if source.use_session_flag and not update.session_flag:
            logger.debug(
                "source {} id {} session flag is false for session-aware source, skipping",
                source.source_name,
                source.source_id,
            )
            return None

        # STALENESS CHECK: Reject prices older than threshold
        time_diff = update.time_diff(now)
        if time_diff >= self.stale_price_threshold_seconds:
            logger.warning(
                "source {} id {} is stale by {} seconds",
                source.source_name,
                source.source_id,
                time_diff,
            )
            return None

        # Valid price found - apply exponent scaling if configured
        price: float | str = update.price
        if source.exponent is not None:
            # Scale raw integer price by exponent
            # e.g., 6500000000000 with exponent=-8 becomes 65000.0
            scaled: float = float(price) / (10.0**-source.exponent)
            return scaled
        return price

    def get_price_from_pair_source(
        self,
        base_source: PriceSource,
        quote_source: PriceSource,
    ) -> str | None:
        """
        Compute price as base_price / quote_price.

        Common use: Get USD price via USDT (e.g., BTC/USDT to get BTC in USD).
        Returns None if either source is invalid/stale (both must be valid).
        """
        base_price = self.get_price_from_single_source(base_source)
        if base_price is None:
            return None
        quote_price = self.get_price_from_single_source(quote_source)
        if quote_price is None or float(quote_price) == 0:
            return None

        return str(float(base_price) / float(quote_price))

    def get_price_from_oracle_mid_average(
        self,
        symbol: str,
        oracle_update: OracleUpdate,
    ) -> float | None:
        """
        Compute mark price as average of oracle price and market mid price.

        Formula: (oracle_price + mid_price) / 2

        This creates a mark price responsive to trading activity while anchored
        to the oracle. Useful for funding rate calculations.

        Requires:
        - Oracle price already computed (from oracle_update)
        - Fresh mid price from Hyperliquid allMids subscription
        """
        oracle_price = oracle_update.oracle.get(symbol)
        if oracle_price is None:
            return None

        mid_price_update = self.hl_mid_state.get(symbol)
        if mid_price_update is None:
            logger.warning("mid price for {} is missing", symbol)
            return None
        time_diff = mid_price_update.time_diff(time.time())
        if time_diff >= self.stale_price_threshold_seconds:
            logger.warning("mid price for {} is stale by {} seconds", symbol, time_diff)
            return None

        return (float(oracle_price) + float(mid_price_update.price)) / 2.0

    def get_price_from_session_ema_source(
        self,
        oracle_source: PriceSource,
        ema_source: PriceSource,
    ) -> list[float | str] | None:
        """
        Compute session-aware mark price for assets with trading sessions.

        HYPERLIQUID MEDIAN HACK:
        Hyperliquid calculates the final mark price as:
            new_mark = median(markPxs[0], markPxs[1], local_mark)
        where local_mark = median(best_bid, best_ask, last_trade).

        By controlling the two markPxs values, we can influence the median:
        - Off hours: [oracle, oracle] -> median of [oracle, oracle, local] = oracle
          (oracle appears twice, so it's guaranteed to be the median)
        - Market hours: [oracle, ema] -> median of [oracle, ema, local]
          (all three values can influence the result)

        Returns:
            - During market hours (session_flag=false): [oracle_price, ema_price]
            - Off hours (session_flag=true): [oracle_price, oracle_price]
            - None if data is missing/stale

        The session_flag typically comes from a SEDA feed that knows market hours.

        FALLBACK: If EMA price is missing during market hours, fall back to
        [oracle, oracle] to avoid publishing stale EMA values.
        """
        now = time.time()
        source_state = self.all_states.get(oracle_source.source_name)
        if source_state is None:
            logger.warning("source {} is unknown", oracle_source.source_name)
            return None
        oracle_update = source_state.get(oracle_source.source_id)

        if oracle_update is None:
            logger.warning(
                "source {} id {} is missing",
                oracle_source.source_name,
                oracle_source.source_id,
            )
            return None

        # Check staleness
        time_diff = oracle_update.time_diff(now)
        if time_diff >= self.stale_price_threshold_seconds:
            logger.warning(
                "source {} id {} is stale by {} seconds",
                oracle_source.source_name,
                oracle_source.source_id,
                time_diff,
            )
            return None

        # session_flag=true means market is CLOSED (off hours)
        if oracle_update.session_flag:
            # Off hours: use oracle price for both mark slots
            return [oracle_update.price, oracle_update.price]

        # Market hours: include EMA for second mark slot
        ema_price = self.get_price_from_single_source(ema_source)
        if ema_price is None:
            # FALLBACK: EMA missing during market hours - use oracle for both
            # This is unlikely since SEDA typically returns both fields together
            logger.warning(
                "source {} id {} ema price is missing",
                oracle_source.source_name,
                oracle_source.source_id,
            )
            return [oracle_update.price, oracle_update.price]

        return [oracle_update.price, ema_price]
