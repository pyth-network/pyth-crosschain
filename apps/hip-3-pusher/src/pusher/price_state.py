from dataclasses import dataclass
from loguru import logger
import time

from pusher.config import Config, PriceSource, PriceSourceConfig, ConstantSourceConfig, SingleSourceConfig, \
    PairSourceConfig

DEFAULT_STALE_PRICE_THRESHOLD_SECONDS = 5


@dataclass
class PriceUpdate:
    price: float | str
    timestamp: float

    def time_diff(self, now):
        return now - self.timestamp


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

    def get_all_prices(self, market_name):
        logger.debug("get_all_prices state: {}", self.all_states)

        return (
            self.get_prices(self.price_config.oracle, market_name),
            self.get_prices(self.price_config.mark, market_name),
            self.get_prices(self.price_config.external, market_name)
        )

    def get_prices(self, symbol_configs: dict[str, list[PriceSourceConfig]], market_name: str):
        pxs = {}
        for symbol in symbol_configs:
            for source_config in symbol_configs[symbol]:
                # find first valid price in the waterfall
                px = self.get_price(source_config)
                if px is not None:
                    pxs[f"{market_name}:{symbol}"] = str(px)
                    break
        return pxs

    def get_price(self, price_source_config: PriceSourceConfig):
        if isinstance(price_source_config, ConstantSourceConfig):
            return price_source_config.value
        elif isinstance(price_source_config, SingleSourceConfig):
            return self.get_price_from_single_source(price_source_config.source)
        elif isinstance(price_source_config, PairSourceConfig):
            return self.get_price_from_pair_source(price_source_config.base_source, price_source_config.quote_source)
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
