import time

from pusher.config import Config, LazerConfig, HermesConfig, PriceConfig, PriceSource, SingleSourceConfig, \
    PairSourceConfig, HyperliquidConfig
from pusher.price_state import PriceState, PriceUpdate

DEX = "pyth"
SYMBOL = "BTC"


def get_config():
    config: Config = Config.model_construct()
    config.stale_price_threshold_seconds = 5
    config.hyperliquid = HyperliquidConfig.model_construct()
    config.hyperliquid.asset_context_symbols = [SYMBOL]
    config.lazer = LazerConfig.model_construct()
    config.lazer.feed_ids = [1, 8]
    config.hermes = HermesConfig.model_construct()
    config.hermes.feed_ids = ["e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b"]
    config.price = PriceConfig(
        oracle={
            SYMBOL: [
                SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id="BTC", exponent=None)),
                PairSourceConfig(source_type="pair",
                                 base_source=PriceSource(source_name="lazer", source_id=1, exponent=-8),
                                 quote_source=PriceSource(source_name="lazer", source_id=8, exponent=-8)),
                PairSourceConfig(source_type="pair",
                                 base_source=PriceSource(source_name="hermes", source_id="e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", exponent=-8),
                                 quote_source=PriceSource(source_name="hermes", source_id="2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b", exponent=-8))
            ]
        },
        mark={},
        external={}
    )
    return config


def test_good_hl_price():
    """
    Pass through fresh HL oracle price.
    """
    config = get_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.hl_oracle_state.put(SYMBOL, PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds / 2.0))

    oracle_px, _, _ = price_state.get_all_prices(DEX)
    assert oracle_px == {f"{DEX}:{SYMBOL}": "110000.0"}


def test_fallback_lazer():
    """
    HL oracle price is stale, so fall back to fresh Lazer price.
    """
    config = get_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.hl_oracle_state.put(SYMBOL, PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds - 1.0))
    price_state.lazer_state.put(1, PriceUpdate("11050000000000", now - price_state.stale_price_threshold_seconds / 2.0))
    price_state.lazer_state.put(8, PriceUpdate("99000000", now - price_state.stale_price_threshold_seconds / 2.0))

    oracle_px, _, _ = price_state.get_all_prices(DEX)
    assert oracle_px == {f"{DEX}:{SYMBOL}": "111616.16"}



def test_fallback_hermes():
    """
    HL oracle price and Lazer prices are stale, so fall back to fresh Hermes price.
    """
    config = get_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.hl_oracle_state.put(SYMBOL, PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds - 1.0))
    price_state.lazer_state.put(1, PriceUpdate("11050000000000", now - price_state.stale_price_threshold_seconds - 1.0))
    price_state.lazer_state.put(8, PriceUpdate("99000000", now - price_state.stale_price_threshold_seconds / 2.0))
    price_state.hermes_state.put("e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
                                 PriceUpdate("11100000000000", now - price_state.stale_price_threshold_seconds / 2.0))
    price_state.hermes_state.put("2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
                                 PriceUpdate("98000000", now - price_state.stale_price_threshold_seconds / 2.0))

    oracle_px, _, _ = price_state.get_all_prices(DEX)
    assert oracle_px == {f"{DEX}:{SYMBOL}": "113265.31"}


def test_all_fail():
    """
    All prices are stale, so return nothing.
    """
    config = get_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.hl_oracle_state.put(SYMBOL, PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds - 1.0))
    price_state.lazer_state.put(1, PriceUpdate("11050000000000", now - price_state.stale_price_threshold_seconds - 1.0))
    price_state.lazer_state.put(8, PriceUpdate("99000000", now - price_state.stale_price_threshold_seconds - 1.0))
    price_state.hermes_state.put("e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
                                 PriceUpdate("11100000000000", now - price_state.stale_price_threshold_seconds - 1.0))
    price_state.hermes_state.put("2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
                                 PriceUpdate("98000000", now - price_state.stale_price_threshold_seconds - 1.0))

    oracle_px, _, _ = price_state.get_all_prices(DEX)
    assert oracle_px == {}
