from dataclasses import dataclass
from loguru import logger
import time

from pusher.config import Config, PriceSource, PriceSourceConfig, ConstantSourceConfig, SingleSourceConfig, \
    PairSourceConfig, OracleMidAverageConfig

DEFAULT_STALE_PRICE_THRESHOLD_SECONDS = 5


@dataclass
class PriceUpdate:
    price: float | str
    timestamp: float

    def time_diff(self, now):
        return now - self.timestamp


@dataclass
class OracleUpdate:
    oracle: dict[str, str]
    mark: dict[str, str]
    external: dict[str, str]


class PriceSourceState:
    def __init__(self, name: str):
        self.name = name
        self.state: dict[str, PriceUpdate] = {}

    def __repr__(self):
        return f"PriceSourceState(name={self.name} state={self.state})"

    def get(self, symbol: str) -> PriceUpdate | None:
        return self.state.get(symbol)

    def put(self, symbol: str, value: PriceUpdate):
        self.state[symbol] = value


class PriceState:
    HL_ORACLE = "hl_oracle"
    HL_MARK = "hl_mark"
    HL_MID = "hl_mid"
    LAZER = "lazer"
    HERMES = "hermes"
    SEDA = "seda"

    """
    Maintain latest prices seen across listeners and publisher.
    """
    def __init__(self, config: Config):
        self.market_name = config.hyperliquid.market_name
        self.stale_price_threshold_seconds = config.stale_price_threshold_seconds
        self.price_config = config.price

        self.hl_oracle_state = PriceSourceState(self.HL_ORACLE)
        self.hl_mark_state = PriceSourceState(self.HL_MARK)
        self.hl_mid_state = PriceSourceState(self.HL_MID)
        self.lazer_state = PriceSourceState(self.LAZER)
        self.hermes_state = PriceSourceState(self.HERMES)
        self.seda_state = PriceSourceState(self.SEDA)

        self.all_states = {
            self.HL_ORACLE: self.hl_oracle_state,
            self.HL_MARK: self.hl_mark_state,
            self.HL_MID: self.hl_mid_state,
            self.LAZER: self.lazer_state,
            self.HERMES: self.hermes_state,
            self.SEDA: self.seda_state,
        }

    def get_all_prices(self) -> OracleUpdate:
        logger.debug("get_all_prices state: {}", self.all_states)

        oracle_update = OracleUpdate({}, {}, {})
        oracle_update.oracle = self.get_prices(self.price_config.oracle, oracle_update)
        oracle_update.mark = self.get_prices(self.price_config.mark, oracle_update)
        oracle_update.external = self.get_prices(self.price_config.external, oracle_update)

        return oracle_update

    def get_prices(self, symbol_configs: dict[str, list[PriceSourceConfig]], oracle_update: OracleUpdate):
        pxs = {}
        for symbol in symbol_configs:
            for source_config in symbol_configs[symbol]:
                # find first valid price in the waterfall
                px = self.get_price(source_config, oracle_update)
                if px is not None:
                    pxs[f"{self.market_name}:{symbol}"] = str(px)
                    break
        return pxs

    def get_price(self, price_source_config: PriceSourceConfig, oracle_update: OracleUpdate):
        if isinstance(price_source_config, ConstantSourceConfig):
            return price_source_config.value
        elif isinstance(price_source_config, SingleSourceConfig):
            return self.get_price_from_single_source(price_source_config.source)
        elif isinstance(price_source_config, PairSourceConfig):
            return self.get_price_from_pair_source(price_source_config.base_source, price_source_config.quote_source)
        elif isinstance(price_source_config, OracleMidAverageConfig):
            return self.get_price_from_oracle_mid_average(price_source_config.symbol, oracle_update)
        else:
            raise ValueError

    def get_price_from_single_source(self, source: PriceSource):
        now = time.time()
        update: PriceUpdate | None = self.all_states.get(source.source_name, {}).get(source.source_id)
        if update is None:
            logger.warning("source {} id {} is missing", source.source_name, source.source_id)
            return None
        time_diff = update.time_diff(now)
        if time_diff >= self.stale_price_threshold_seconds:
            logger.warning("source {} id {} is stale by {} seconds", source.source_name, source.source_id, time_diff)
            return None
        # valid price found
        if source.exponent is not None:
            return float(update.price) / (10.0 ** -source.exponent)
        else:
            return update.price

    def get_price_from_pair_source(self, base_source: PriceSource, quote_source: PriceSource):
        base_price = self.get_price_from_single_source(base_source)
        if base_price is None:
            return None
        quote_price = self.get_price_from_single_source(quote_source)
        if quote_price is None:
            return None

        return str(round(float(base_price) / float(quote_price), 2))

    def get_price_from_oracle_mid_average(self, symbol: str, oracle_update: OracleUpdate):
        oracle_price = oracle_update.oracle.get(symbol)
        if oracle_price is None:
            return None

        mid_price_update: PriceUpdate | None = self.hl_mid_state.get(symbol)
        if mid_price_update is None:
            logger.warning("mid price for {} is missing", symbol)
            return None
        time_diff = mid_price_update.time_diff(time.time())
        if time_diff >= self.stale_price_threshold_seconds:
            logger.warning("mid price for {} is stale by {} seconds", symbol, time_diff)
            return None

        return (float(oracle_price) + float(mid_price_update.price)) / 2.0
