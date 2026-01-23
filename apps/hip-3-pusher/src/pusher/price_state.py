from dataclasses import dataclass
from loguru import logger
import time
from typing import Any

from pusher.config import Config, PriceSource, PriceSourceConfig, ConstantSourceConfig, SingleSourceConfig, \
    PairSourceConfig, OracleMidAverageConfig, SessionEMASourceConfig

DEFAULT_STALE_PRICE_THRESHOLD_SECONDS = 5


@dataclass
class PriceUpdate:
    price: float | str
    timestamp: float
    session_flag: bool = False

    def time_diff(self, now: float) -> float:
        return now - self.timestamp


@dataclass
class OracleUpdate:
    oracle: dict[str, str]
    mark: dict[str, str | list[Any]]
    external: dict[str, str]


class PriceSourceState:
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
    HL_ORACLE = "hl_oracle"
    HL_MARK = "hl_mark"
    HL_MID = "hl_mid"
    LAZER = "lazer"
    HERMES = "hermes"
    SEDA = "seda"
    SEDA_LAST = "seda_last"
    SEDA_EMA = "seda_ema"

    """
    Maintain latest prices seen across listeners and publisher.
    """
    def __init__(self, config: Config) -> None:
        self.market_name = config.hyperliquid.market_name
        self.stale_price_threshold_seconds = config.stale_price_threshold_seconds
        self.price_config = config.price

        self.hl_oracle_state = PriceSourceState(self.HL_ORACLE)
        self.hl_mark_state = PriceSourceState(self.HL_MARK)
        self.hl_mid_state = PriceSourceState(self.HL_MID)
        self.lazer_state = PriceSourceState(self.LAZER)
        self.hermes_state = PriceSourceState(self.HERMES)
        self.seda_state = PriceSourceState(self.SEDA)
        self.seda_last_state = PriceSourceState(self.SEDA_LAST)
        self.seda_ema_state = PriceSourceState(self.SEDA_EMA)

        self.all_states: dict[str, PriceSourceState] = {
            self.HL_ORACLE: self.hl_oracle_state,
            self.HL_MARK: self.hl_mark_state,
            self.HL_MID: self.hl_mid_state,
            self.LAZER: self.lazer_state,
            self.HERMES: self.hermes_state,
            self.SEDA: self.seda_state,
            self.SEDA_LAST: self.seda_last_state,
            self.SEDA_EMA: self.seda_ema_state,
        }

    def get_all_prices(self) -> OracleUpdate:
        logger.debug("get_all_prices state: {}", self.all_states)

        oracle_update = OracleUpdate({}, {}, {})
        oracle_update.oracle = self.get_prices(self.price_config.oracle, oracle_update)
        oracle_update.mark = self.get_prices(self.price_config.mark, oracle_update)
        oracle_update.external = self.get_prices(self.price_config.external, oracle_update)

        return oracle_update

    def get_prices(self, symbol_configs: dict[str, list[PriceSourceConfig]], oracle_update: OracleUpdate) -> dict[str, Any]:
        """
        Return a dict of prices per symbol for a price type.
        :param symbol_configs: Price configs for one of oracle, mark, external.
        :param oracle_update: In certain mark price types we want to blend in the oracle price.
        :return:
        """
        pxs: dict[str, Any] = {}
        for symbol in symbol_configs:
            for source_config in symbol_configs[symbol]:
                try:
                    # find first valid price in the waterfall
                    px = self.get_price(source_config, oracle_update)
                    if px is not None:
                        # Normalize to either a string or list of strings.
                        # We could be working with numbers (as the result of a division or API type)
                        # or a string, or in the case of dreamcash a list of mark prices.
                        # The Hyperliquid API ultimately needs strings.
                        if not isinstance(px, str) and not isinstance(px, list):
                            px = str(px)
                        pxs[f"{self.market_name}:{symbol}"] = px
                        break
                except Exception as e:
                    logger.exception("get_price exception for symbol: {} source_config: {} error: {}", symbol, source_config, repr(e))
        return pxs

    def get_price(self, price_source_config: PriceSourceConfig, oracle_update: OracleUpdate) -> str | float | list[float | str] | None:
        if isinstance(price_source_config, ConstantSourceConfig):
            return str(price_source_config.value)
        elif isinstance(price_source_config, SingleSourceConfig):
            return self.get_price_from_single_source(price_source_config.source)
        elif isinstance(price_source_config, PairSourceConfig):
            return self.get_price_from_pair_source(price_source_config.base_source, price_source_config.quote_source)
        elif isinstance(price_source_config, OracleMidAverageConfig):
            return self.get_price_from_oracle_mid_average(price_source_config.symbol, oracle_update)
        elif isinstance(price_source_config, SessionEMASourceConfig):
            return self.get_price_from_session_ema_source(price_source_config.oracle_source, price_source_config.ema_source)
        else:
            raise ValueError

    def get_price_from_single_source(self, source: PriceSource) -> float | str | None:
        now = time.time()
        source_state = self.all_states.get(source.source_name)
        if source_state is None:
            logger.warning("source {} is unknown", source.source_name)
            return None
        update = source_state.get(source.source_id)

        if update is None:
            logger.warning("source {} id {} is missing", source.source_name, source.source_id)
            return None

        # check session-aware source
        if source.use_session_flag and not update.session_flag:
            logger.debug("source {} id {} session flag is false for session-aware source, skipping", source.source_name, source.source_id)
            return None

        # check staleness
        time_diff = update.time_diff(now)
        if time_diff >= self.stale_price_threshold_seconds:
            logger.warning("source {} id {} is stale by {} seconds", source.source_name, source.source_id, time_diff)
            return None

        # valid price found
        price: float | str = update.price
        if source.exponent is not None:
            scaled: float = float(price) / (10.0 ** -source.exponent)
            return scaled
        return price

    def get_price_from_pair_source(self, base_source: PriceSource, quote_source: PriceSource) -> str | None:
        base_price = self.get_price_from_single_source(base_source)
        if base_price is None:
            return None
        quote_price = self.get_price_from_single_source(quote_source)
        if quote_price is None or float(quote_price) == 0:
            return None

        return str(float(base_price) / float(quote_price))

    def get_price_from_oracle_mid_average(self, symbol: str, oracle_update: OracleUpdate) -> float | None:
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

    def get_price_from_session_ema_source(self, oracle_source: PriceSource, ema_source: PriceSource) -> list[float | str] | None:
        """
        Use session-aware mark price of [oracle,oracle] or [oracle,ema] as per customer request.
        :param oracle_source: Oracle price source config (probably SEDA feed price field)
        :param ema_source: EMA price source config (probably SEDA feed mark_px_ema field)
        :return: None if missing/stale, [oracle, oracle] off hours, [oracle, ema] during market hours
        """
        now = time.time()
        source_state = self.all_states.get(oracle_source.source_name)
        if source_state is None:
            logger.warning("source {} is unknown", oracle_source.source_name)
            return None
        oracle_update = source_state.get(oracle_source.source_id)

        if oracle_update is None:
            logger.warning("source {} id {} is missing", oracle_source.source_name, oracle_source.source_id)
            return None
        # check staleness
        time_diff = oracle_update.time_diff(now)
        if time_diff >= self.stale_price_threshold_seconds:
            logger.warning("source {} id {} is stale by {} seconds", oracle_source.source_name, oracle_source.source_id, time_diff)
            return None

        # flag is true during off hours
        if oracle_update.session_flag:
            return [oracle_update.price, oracle_update.price]

        # otherwise, during market hours, include ema
        ema_price = self.get_price_from_single_source(ema_source)
        # unlikely as SEDA feed will include both fields, but in this case, use [oracle, oracle]
        if ema_price is None:
            logger.warning("source {} id {} ema price is missing", oracle_source.source_name, oracle_source.source_id)
            return [oracle_update.price, oracle_update.price]

        return [oracle_update.price, ema_price]
