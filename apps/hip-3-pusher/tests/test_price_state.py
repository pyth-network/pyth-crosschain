import time

from pusher.config import Config, LazerConfig, HermesConfig
from pusher.price_state import PriceState, PriceUpdate


def get_config():
    config: Config = Config.model_construct()
    config.stale_price_threshold_seconds = 5
    config.lazer = LazerConfig.model_construct()
    config.lazer.base_feed_exponent = -8
    config.lazer.quote_feed_exponent = -8
    config.hermes = HermesConfig.model_construct()
    config.hermes.base_feed_exponent = -8
    config.hermes.quote_feed_exponent = -8
    return config


def test_good_hl_price():
    config = get_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.hl_oracle_price = PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds / 2.0)

    oracle_px = price_state.get_current_oracle_price()
    assert oracle_px == price_state.hl_oracle_price.price
    assert oracle_px == "110000.0"



def test_fallback_lazer():
    config = get_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.hl_oracle_price = PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds - 1.0)
    price_state.lazer_base_price = PriceUpdate("11050000000000", now - price_state.stale_price_threshold_seconds / 2.0)
    price_state.lazer_quote_price = PriceUpdate("99000000", now - price_state.stale_price_threshold_seconds / 2.0)

    oracle_px = price_state.get_current_oracle_price()
    assert oracle_px == price_state.get_lazer_price()
    assert oracle_px == "111616.16"



def test_fallback_hermes():
    config = get_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.hl_oracle_price = PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds - 1.0)
    price_state.lazer_base_price = PriceUpdate("11050000000000", now - price_state.stale_price_threshold_seconds - 1.0)
    price_state.lazer_quote_price = PriceUpdate("99000000", now - price_state.stale_price_threshold_seconds / 2.0)
    price_state.hermes_base_price = PriceUpdate("11100000000000", now - price_state.stale_price_threshold_seconds / 2.0)
    price_state.hermes_quote_price = PriceUpdate("98000000", now - price_state.stale_price_threshold_seconds / 2.0)

    oracle_px = price_state.get_current_oracle_price()
    assert oracle_px == price_state.get_hermes_price()
    assert oracle_px == "113265.31"


def test_all_fail():
    config = get_config()
    price_state = PriceState(config)
    now = time.time()
    price_state.hl_oracle_price = PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds - 1.0)
    price_state.hl_oracle_price = PriceUpdate("110000.0", now - price_state.stale_price_threshold_seconds - 1.0)
    price_state.lazer_base_price = PriceUpdate("11050000000000", now - price_state.stale_price_threshold_seconds - 1.0)
    price_state.lazer_quote_price = PriceUpdate("99000000", now - price_state.stale_price_threshold_seconds - 1.0)
    price_state.hermes_base_price = PriceUpdate("11100000000000", now - price_state.stale_price_threshold_seconds - 1.0)
    price_state.hermes_quote_price = PriceUpdate("98000000", now - price_state.stale_price_threshold_seconds - 1.0)
    assert price_state.get_current_oracle_price() is None
