import time

from pusher.config import (
    Config,
    ConstantSourceConfig,
    HermesConfig,
    HyperliquidConfig,
    LazerConfig,
    OracleMidAverageConfig,
    PairSourceConfig,
    PriceConfig,
    PriceSource,
    SessionEMASourceConfig,
    SingleSourceConfig,
)
from pusher.price_state import PriceSourceState, PriceState, PriceUpdate

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
    config.hermes = HermesConfig.model_construct()
    config.hermes.feed_ids = [
        "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
        "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
    ]
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
                PairSourceConfig(
                    source_type="pair",
                    base_source=PriceSource(
                        source_name="hermes",
                        source_id="e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
                        exponent=-8,
                    ),
                    quote_source=PriceSource(
                        source_name="hermes",
                        source_id="2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
                        exponent=-8,
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
    config.hermes = HermesConfig.model_construct()
    config.hermes.feed_ids = []
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


def test_fallback_hermes():
    """
    HL oracle price and Lazer prices are stale, so fall back to fresh Hermes price.
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
        PriceUpdate("99000000", now - price_state.stale_price_threshold_seconds / 2.0),
    )
    price_state.hermes_state.put(
        "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
        PriceUpdate(
            "11100000000000", now - price_state.stale_price_threshold_seconds / 2.0
        ),
    )
    price_state.hermes_state.put(
        "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
        PriceUpdate("98000000", now - price_state.stale_price_threshold_seconds / 2.0),
    )

    oracle_update = price_state.get_all_prices()
    assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "113265.30612244898"}


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
    price_state.hermes_state.put(
        "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
        PriceUpdate(
            "11100000000000", now - price_state.stale_price_threshold_seconds - 1.0
        ),
    )
    price_state.hermes_state.put(
        "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
        PriceUpdate("98000000", now - price_state.stale_price_threshold_seconds - 1.0),
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


class TestPriceUpdate:
    """Tests for the PriceUpdate dataclass."""

    def test_time_diff_positive(self):
        """time_diff returns positive value for past timestamps."""
        now = time.time()
        update = PriceUpdate("100.0", now - 5.0)
        diff = update.time_diff(now)
        assert 4.9 < diff < 5.1

    def test_time_diff_zero(self):
        """time_diff returns approximately zero for current timestamp."""
        now = time.time()
        update = PriceUpdate("100.0", now)
        diff = update.time_diff(now)
        assert -0.1 < diff < 0.1

    def test_time_diff_negative(self):
        """time_diff returns negative value for future timestamps."""
        now = time.time()
        update = PriceUpdate("100.0", now + 5.0)
        diff = update.time_diff(now)
        assert -5.1 < diff < -4.9

    def test_session_flag_default(self):
        """session_flag defaults to False."""
        update = PriceUpdate("100.0", time.time())
        assert update.session_flag is False

    def test_session_flag_true(self):
        """session_flag can be set to True."""
        update = PriceUpdate("100.0", time.time(), session_flag=True)
        assert update.session_flag is True

    def test_price_as_string(self):
        """Price can be stored as string."""
        update = PriceUpdate("65000.50", time.time())
        assert update.price == "65000.50"

    def test_price_as_float(self):
        """Price can be stored as float."""
        update = PriceUpdate(65000.50, time.time())
        assert update.price == 65000.50


class TestPriceSourceState:
    """Tests for the PriceSourceState class."""

    def test_init(self):
        """PriceSourceState initializes with name and empty state."""
        state = PriceSourceState("test_source")
        assert state.name == "test_source"
        assert state.state == {}

    def test_put_and_get(self):
        """put stores and get retrieves PriceUpdate."""
        state = PriceSourceState("test")
        update = PriceUpdate("100.0", time.time())
        state.put("BTC", update)
        assert state.get("BTC") == update

    def test_get_missing_key(self):
        """get returns None for missing keys."""
        state = PriceSourceState("test")
        assert state.get("MISSING") is None

    def test_put_overwrites(self):
        """put overwrites existing values."""
        state = PriceSourceState("test")
        update1 = PriceUpdate("100.0", time.time())
        update2 = PriceUpdate("200.0", time.time())
        state.put("BTC", update1)
        state.put("BTC", update2)
        assert state.get("BTC") == update2

    def test_numeric_key(self):
        """State supports numeric keys (for Lazer feed IDs)."""
        state = PriceSourceState("lazer")
        update = PriceUpdate("100.0", time.time())
        state.put(1, update)
        assert state.get(1) == update

    def test_repr(self):
        """__repr__ returns readable string."""
        state = PriceSourceState("test")
        state.put("BTC", PriceUpdate("100.0", 1234567890.0))
        repr_str = repr(state)
        assert "test" in repr_str
        assert "BTC" in repr_str


class TestConstantSourceConfig:
    """Tests for ConstantSourceConfig handling."""

    def test_constant_source_returns_value(self):
        """Constant source always returns its configured value."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = []
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "STABLE": [ConstantSourceConfig(source_type="constant", value="1.0000")]
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:STABLE": "1.0000"}

    def test_constant_source_not_affected_by_staleness(self):
        """Constant source is never stale."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 0
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = []
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "STABLE": [ConstantSourceConfig(source_type="constant", value="1.0000")]
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:STABLE": "1.0000"}


class TestOracleMidAverageConfig:
    """Tests for OracleMidAverageConfig handling."""

    def test_oracle_mid_average_computes_average(self):
        """oracle_mid_average returns average of oracle and mid price."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = ["BTC"]
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="hl_oracle", source_id="BTC", exponent=None
                        ),
                    )
                ]
            },
            mark={
                "BTC": [
                    OracleMidAverageConfig(
                        source_type="oracle_mid_average", symbol="pyth:BTC"
                    )
                ]
            },
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("BTC", PriceUpdate("100000.0", now - 1.0))
        price_state.hl_mid_state.put("pyth:BTC", PriceUpdate("100100.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:BTC": "100000.0"}
        assert oracle_update.mark == {"pyth:BTC": "100050.0"}

    def test_oracle_mid_average_missing_oracle(self):
        """oracle_mid_average returns None when oracle price is missing."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = ["BTC"]
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={},
            mark={
                "BTC": [
                    OracleMidAverageConfig(
                        source_type="oracle_mid_average", symbol="pyth:BTC"
                    )
                ]
            },
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_mid_state.put("pyth:BTC", PriceUpdate("100100.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.mark == {}

    def test_oracle_mid_average_missing_mid(self):
        """oracle_mid_average returns None when mid price is missing."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = ["BTC"]
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="hl_oracle", source_id="BTC", exponent=None
                        ),
                    )
                ]
            },
            mark={
                "BTC": [
                    OracleMidAverageConfig(
                        source_type="oracle_mid_average", symbol="pyth:BTC"
                    )
                ]
            },
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("BTC", PriceUpdate("100000.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:BTC": "100000.0"}
        assert oracle_update.mark == {}

    def test_oracle_mid_average_stale_mid(self):
        """oracle_mid_average returns None when mid price is stale."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = ["BTC"]
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="hl_oracle", source_id="BTC", exponent=None
                        ),
                    )
                ]
            },
            mark={
                "BTC": [
                    OracleMidAverageConfig(
                        source_type="oracle_mid_average", symbol="pyth:BTC"
                    )
                ]
            },
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("BTC", PriceUpdate("100000.0", now - 1.0))
        price_state.hl_mid_state.put("pyth:BTC", PriceUpdate("100100.0", now - 10.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:BTC": "100000.0"}
        assert oracle_update.mark == {}


class TestPairSourceConfig:
    """Tests for PairSourceConfig handling."""

    def test_pair_source_zero_quote_price(self):
        """Pair source returns None when quote price is zero."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = []
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = [1, 8]
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    PairSourceConfig(
                        source_type="pair",
                        base_source=PriceSource(
                            source_name="lazer", source_id=1, exponent=-8
                        ),
                        quote_source=PriceSource(
                            source_name="lazer", source_id=8, exponent=-8
                        ),
                    )
                ]
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.lazer_state.put(1, PriceUpdate("6500000000000", now - 1.0))
        price_state.lazer_state.put(8, PriceUpdate("0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {}

    def test_pair_source_missing_base(self):
        """Pair source returns None when base price is missing."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = []
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = [1, 8]
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    PairSourceConfig(
                        source_type="pair",
                        base_source=PriceSource(
                            source_name="lazer", source_id=1, exponent=-8
                        ),
                        quote_source=PriceSource(
                            source_name="lazer", source_id=8, exponent=-8
                        ),
                    )
                ]
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.lazer_state.put(8, PriceUpdate("100000000", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {}

    def test_pair_source_missing_quote(self):
        """Pair source returns None when quote price is missing."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = []
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = [1, 8]
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    PairSourceConfig(
                        source_type="pair",
                        base_source=PriceSource(
                            source_name="lazer", source_id=1, exponent=-8
                        ),
                        quote_source=PriceSource(
                            source_name="lazer", source_id=8, exponent=-8
                        ),
                    )
                ]
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.lazer_state.put(1, PriceUpdate("6500000000000", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {}


class TestExponentScaling:
    """Tests for exponent scaling in price sources."""

    def test_exponent_scaling_negative_8(self):
        """Exponent -8 scales price correctly."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = []
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = [1]
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="lazer", source_id=1, exponent=-8
                        ),
                    )
                ]
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.lazer_state.put(1, PriceUpdate("6500000000000", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:BTC": "65000.0"}

    def test_no_exponent_passthrough(self):
        """No exponent means price is passed through as-is."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = ["BTC"]
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="hl_oracle", source_id="BTC", exponent=None
                        ),
                    )
                ]
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("BTC", PriceUpdate("65000.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:BTC": "65000.0"}


class TestUseSessionFlag:
    """Tests for use_session_flag in price sources."""

    def test_use_session_flag_true_with_session_flag_true(self):
        """Source with use_session_flag=True is used when session_flag=True."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = []
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "SPY": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="seda_last",
                            source_id="SPY",
                            exponent=None,
                            use_session_flag=True,
                        ),
                    )
                ]
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.seda_last_state.put(
            "SPY", PriceUpdate("450.00", now - 1.0, session_flag=True)
        )

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:SPY": "450.00"}

    def test_use_session_flag_true_with_session_flag_false(self):
        """Source with use_session_flag=True is skipped when session_flag=False."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = []
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "SPY": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="seda_last",
                            source_id="SPY",
                            exponent=None,
                            use_session_flag=True,
                        ),
                    )
                ]
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.seda_last_state.put(
            "SPY", PriceUpdate("450.00", now - 1.0, session_flag=False)
        )

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {}


class TestExternalPrices:
    """Tests for external price handling."""

    def test_external_prices_populated(self):
        """External prices are populated in OracleUpdate."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = ["BTC"]
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={},
            mark={},
            external={
                "BTC": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="hl_oracle", source_id="BTC", exponent=None
                        ),
                    )
                ]
            },
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("BTC", PriceUpdate("65000.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.external == {"pyth:BTC": "65000.0"}


class TestMultipleSymbols:
    """Tests for handling multiple symbols."""

    def test_multiple_symbols_in_oracle(self):
        """Multiple symbols are handled correctly."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = ["BTC", "ETH"]
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="hl_oracle", source_id="BTC", exponent=None
                        ),
                    )
                ],
                "ETH": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="hl_oracle", source_id="ETH", exponent=None
                        ),
                    )
                ],
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("BTC", PriceUpdate("65000.0", now - 1.0))
        price_state.hl_oracle_state.put("ETH", PriceUpdate("3500.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:BTC": "65000.0", "pyth:ETH": "3500.0"}

    def test_partial_symbol_availability(self):
        """Only available symbols are returned."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = ["BTC", "ETH"]
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="hl_oracle", source_id="BTC", exponent=None
                        ),
                    )
                ],
                "ETH": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="hl_oracle", source_id="ETH", exponent=None
                        ),
                    )
                ],
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("BTC", PriceUpdate("65000.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:BTC": "65000.0"}


class TestUnknownSource:
    """Tests for unknown source name handling."""

    def test_unknown_source_name_returns_none(self):
        """Unknown source name returns None and falls through waterfall."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = ["BTC"]
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="unknown_source", source_id="BTC", exponent=None
                        ),
                    ),
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="hl_oracle", source_id="BTC", exponent=None
                        ),
                    ),
                ]
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("BTC", PriceUpdate("65000.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:BTC": "65000.0"}


class TestHLMarkState:
    """Tests for HL mark state handling."""

    def test_hl_mark_state(self):
        """HL mark state is accessible and usable."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = "pyth"
        config.hyperliquid.asset_context_symbols = ["BTC"]
        config.lazer = LazerConfig.model_construct()
        config.lazer.feed_ids = []
        config.hermes = HermesConfig.model_construct()
        config.hermes.feed_ids = []
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    SingleSourceConfig(
                        source_type="single",
                        source=PriceSource(
                            source_name="hl_mark", source_id="BTC", exponent=None
                        ),
                    )
                ]
            },
            mark={},
            external={},
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_mark_state.put("BTC", PriceUpdate("65100.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {"pyth:BTC": "65100.0"}
