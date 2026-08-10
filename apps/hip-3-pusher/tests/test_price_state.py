import time

from pusher.config import (
    Config,
    HyperliquidConfig,
    LazerConfig,
    PairSourceConfig,
    PriceConfig,
    PriceSource,
    SessionEMASourceConfig,
    SingleSourceConfig,
)
from pusher.price_state import PriceState, PriceUpdate

DEX = "pyth"
SYMBOL = "BTC"


def get_config():
    config: Config = Config.model_construct()
    config.stale_price_threshold_seconds = 5
    config.hyperliquid = HyperliquidConfig.model_construct()
    config.hyperliquid.market_name = "pyth"
    config.hyperliquid.asset_context_symbols = [SYMBOL]
    config.lazer = LazerConfig.model_construct()
    config.lazer.feed_ids = [1, 8]
    config.price = PriceConfig(
        oracle={
            SYMBOL: [
                SingleSourceConfig(
                    source_type="single",
                    source=PriceSource(
                        source_name="hl_oracle", source_id="BTC", exponent=None
                    ),
                ),
                PairSourceConfig(
                    source_type="pair",
                    base_source=PriceSource(
                        source_name="lazer", source_id=1, exponent=-8
                    ),
                    quote_source=PriceSource(
                        source_name="lazer", source_id=8, exponent=-8
                    ),
                ),
            ]
        },
        mark={},
        external={},
    )
    return config


def get_session_ema_config():
    config: Config = Config.model_construct()
    config.stale_price_threshold_seconds = 5
    config.hyperliquid = HyperliquidConfig.model_construct()
    config.hyperliquid.market_name = "pyth"
    config.hyperliquid.asset_context_symbols = []
    config.lazer = LazerConfig.model_construct()
    config.lazer.feed_ids = []
    config.price = PriceConfig(
        oracle={},
        mark={
            SYMBOL: [
                SessionEMASourceConfig(
                    source_type="session_ema",
                    oracle_source=PriceSource(source_name="seda", source_id="BTC"),
                    ema_source=PriceSource(source_name="seda_ema", source_id="BTC"),
                )
            ]
        },
        external={},
    )
    return config


def test_good_hl_price():
    """
    Pass through fresh HL oracle price.
    """
    config = get_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.hl_oracle_state.put(
        SYMBOL,
        PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds / 2.0),
    )

    oracle_update = price_state.get_all_prices()
    assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "110000.0"}


def test_fallback_lazer():
    """
    HL oracle price is stale, so fall back to fresh Lazer price.
    """
    config = get_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.hl_oracle_state.put(
        SYMBOL,
        PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds - 1.0),
    )
    price_state.lazer_state.put(
        1,
        PriceUpdate(
            "11050000000000", now - price_state.stale_price_threshold_seconds / 2.0
        ),
    )
    price_state.lazer_state.put(
        8,
        PriceUpdate("99000000", now - price_state.stale_price_threshold_seconds / 2.0),
    )

    oracle_update = price_state.get_all_prices()
    assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "111616.16161616161"}


def test_all_fail():
    """
    All prices are stale, so return nothing.
    """
    config = get_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.hl_oracle_state.put(
        SYMBOL,
        PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds - 1.0),
    )
    price_state.lazer_state.put(
        1,
        PriceUpdate(
            "11050000000000", now - price_state.stale_price_threshold_seconds - 1.0
        ),
    )
    price_state.lazer_state.put(
        8,
        PriceUpdate("99000000", now - price_state.stale_price_threshold_seconds - 1.0),
    )

    oracle_update = price_state.get_all_prices()
    assert oracle_update.oracle == {}


def test_session_ema_on_hours():
    """
    All prices are stale, so return nothing.
    """
    config = get_session_ema_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.seda_state.put(
        SYMBOL, PriceUpdate("110000.00", now - 1.0, session_flag=False)
    )
    price_state.seda_ema_state.put(SYMBOL, PriceUpdate("105000.00", now - 1.0))

    oracle_update = price_state.get_all_prices()
    assert oracle_update.mark == {f"{DEX}:{SYMBOL}": ["110000.00", "105000.00"]}


def test_session_ema_off_hours():
    """
    All prices are stale, so return nothing.
    """
    config = get_session_ema_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.seda_state.put(
        SYMBOL, PriceUpdate("110000.00", now - 1.0, session_flag=True)
    )
    price_state.seda_ema_state.put(SYMBOL, PriceUpdate("105000.00", now - 1.0))

    oracle_update = price_state.get_all_prices()
    assert oracle_update.mark == {f"{DEX}:{SYMBOL}": ["110000.00", "110000.00"]}


def test_session_ema_oracle_missing():
    """
    All prices are stale, so return nothing.
    """
    config = get_session_ema_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.seda_ema_state.put(SYMBOL, PriceUpdate("105000.00", now - 1.0))

    oracle_update = price_state.get_all_prices()
    assert oracle_update.mark == {}


def test_session_ema_ema_missing():
    """
    All prices are stale, so return nothing.
    """
    config = get_session_ema_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.seda_state.put(
        SYMBOL, PriceUpdate("110000.00", now - 1.0, session_flag=False)
    )

    oracle_update = price_state.get_all_prices()
    assert oracle_update.mark == {f"{DEX}:{SYMBOL}": ["110000.00", "110000.00"]}


def test_session_ema_oracle_stale():
    """
    All prices are stale, so return nothing.
    """
    config = get_session_ema_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.seda_state.put(
        SYMBOL,
        PriceUpdate(
            "110000.00",
            now - price_state.stale_price_threshold_seconds - 1.0,
            session_flag=False,
        ),
    )
    price_state.seda_ema_state.put(
        SYMBOL,
        PriceUpdate("105000.00", now - price_state.stale_price_threshold_seconds - 1.0),
    )

    oracle_update = price_state.get_all_prices()
    assert oracle_update.mark == {}


def test_session_ema_ema_stale():
    """
    All prices are stale, so return nothing.
    """
    config = get_session_ema_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.seda_state.put(
        SYMBOL, PriceUpdate("110000.00", now - 1.0, session_flag=False)
    )
    price_state.seda_ema_state.put(
        SYMBOL,
        PriceUpdate("105000.00", now - price_state.stale_price_threshold_seconds - 1.0),
    )

    oracle_update = price_state.get_all_prices()
    assert oracle_update.mark == {f"{DEX}:{SYMBOL}": ["110000.00", "110000.00"]}
