import pytest
import time

from pusher.config import Config, LazerConfig, HermesConfig, PriceConfig, PriceSource, SingleSourceConfig, \
    PairSourceConfig, HyperliquidConfig, ConstantSourceConfig, OracleMidAverageConfig
from pusher.price_state import PriceState, PriceUpdate, PriceSourceState, OracleUpdate

DEX = "pyth"
SYMBOL = "BTC"


def get_config():
    config: Config = Config.model_construct()
    config.stale_price_threshold_seconds = 5
    config.hyperliquid = HyperliquidConfig.model_construct()
    config.hyperliquid.market_name = DEX
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

    oracle_update = price_state.get_all_prices()
    assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "110000.0"}


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

    oracle_update = price_state.get_all_prices()
    assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "111616.16"}



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

    oracle_update = price_state.get_all_prices()
    assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "113265.31"}


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

    oracle_update = price_state.get_all_prices()
    assert oracle_update.oracle == {}


class TestPriceUpdate:
    """Tests for the PriceUpdate dataclass."""

    def test_time_diff(self):
        """Test time_diff calculation."""
        update = PriceUpdate(price="100.0", timestamp=1000.0)
        assert update.time_diff(1005.0) == 5.0

    def test_time_diff_negative(self):
        """Test time_diff with future timestamp (negative diff)."""
        update = PriceUpdate(price="100.0", timestamp=1010.0)
        assert update.time_diff(1005.0) == -5.0

    def test_price_can_be_float(self):
        """Test that price can be a float."""
        update = PriceUpdate(price=100.5, timestamp=1000.0)
        assert update.price == 100.5

    def test_price_can_be_string(self):
        """Test that price can be a string."""
        update = PriceUpdate(price="100.5", timestamp=1000.0)
        assert update.price == "100.5"


class TestPriceSourceState:
    """Tests for the PriceSourceState class."""

    def test_init(self):
        """Test initialization."""
        state = PriceSourceState("test_source")
        assert state.name == "test_source"
        assert state.state == {}

    def test_put_and_get(self):
        """Test put and get operations."""
        state = PriceSourceState("test_source")
        update = PriceUpdate(price="100.0", timestamp=1000.0)
        state.put("BTC", update)
        assert state.get("BTC") == update

    def test_get_missing_key(self):
        """Test get returns None for missing key."""
        state = PriceSourceState("test_source")
        assert state.get("MISSING") is None

    def test_repr(self):
        """Test string representation."""
        state = PriceSourceState("test_source")
        update = PriceUpdate(price="100.0", timestamp=1000.0)
        state.put("BTC", update)
        repr_str = repr(state)
        assert "test_source" in repr_str
        assert "BTC" in repr_str

    def test_overwrite_value(self):
        """Test that put overwrites existing values."""
        state = PriceSourceState("test_source")
        state.put("BTC", PriceUpdate(price="100.0", timestamp=1000.0))
        state.put("BTC", PriceUpdate(price="200.0", timestamp=2000.0))
        assert state.get("BTC").price == "200.0"


class TestOracleUpdate:
    """Tests for the OracleUpdate dataclass."""

    def test_init(self):
        """Test initialization."""
        update = OracleUpdate(
            oracle={"pyth:BTC": "100.0"},
            mark={"pyth:BTC": "99.0"},
            external={"pyth:ETH": "3000.0"}
        )
        assert update.oracle == {"pyth:BTC": "100.0"}
        assert update.mark == {"pyth:BTC": "99.0"}
        assert update.external == {"pyth:ETH": "3000.0"}

    def test_empty_init(self):
        """Test initialization with empty dicts."""
        update = OracleUpdate(oracle={}, mark={}, external={})
        assert update.oracle == {}
        assert update.mark == {}
        assert update.external == {}


class TestConstantSourceConfig:
    """Tests for constant price source configuration."""

    def test_constant_source(self):
        """Test that constant source returns configured value."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = []
        config.price = PriceConfig(
            oracle={
                "STABLE": [
                    ConstantSourceConfig(source_type="constant", value="1.0")
                ]
            },
            mark={},
            external={}
        )

        price_state = PriceState(config)
        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {f"{DEX}:STABLE": "1.0"}

    def test_constant_source_with_fallback(self):
        """Test constant source as fallback when primary source is stale."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = ["STABLE"]
        config.price = PriceConfig(
            oracle={
                "STABLE": [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id="STABLE", exponent=None)),
                    ConstantSourceConfig(source_type="constant", value="1.0")
                ]
            },
            mark={},
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("STABLE", PriceUpdate("0.99", now - 10.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {f"{DEX}:STABLE": "1.0"}


class TestOracleMidAverageConfig:
    """Tests for oracle-mid average price source configuration."""

    def test_oracle_mid_average(self):
        """Test oracle-mid average calculation."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = [SYMBOL]
        config.price = PriceConfig(
            oracle={
                SYMBOL: [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id=SYMBOL, exponent=None)),
                ]
            },
            mark={
                SYMBOL: [
                    OracleMidAverageConfig(source_type="oracle_mid_average", symbol=f"{DEX}:{SYMBOL}")
                ]
            },
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put(SYMBOL, PriceUpdate("100.0", now - 1.0))
        price_state.hl_mid_state.put(f"{DEX}:{SYMBOL}", PriceUpdate("102.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "100.0"}
        assert oracle_update.mark == {f"{DEX}:{SYMBOL}": "101.0"}

    def test_oracle_mid_average_missing_oracle(self):
        """Test oracle-mid average returns None when oracle price is missing."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = [SYMBOL]
        config.price = PriceConfig(
            oracle={},
            mark={
                SYMBOL: [
                    OracleMidAverageConfig(source_type="oracle_mid_average", symbol=f"{DEX}:{SYMBOL}")
                ]
            },
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_mid_state.put(f"{DEX}:{SYMBOL}", PriceUpdate("102.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.mark == {}

    def test_oracle_mid_average_missing_mid(self):
        """Test oracle-mid average returns None when mid price is missing."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = [SYMBOL]
        config.price = PriceConfig(
            oracle={
                SYMBOL: [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id=SYMBOL, exponent=None)),
                ]
            },
            mark={
                SYMBOL: [
                    OracleMidAverageConfig(source_type="oracle_mid_average", symbol=f"{DEX}:{SYMBOL}")
                ]
            },
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put(SYMBOL, PriceUpdate("100.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "100.0"}
        assert oracle_update.mark == {}

    def test_oracle_mid_average_stale_mid(self):
        """Test oracle-mid average returns None when mid price is stale."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = [SYMBOL]
        config.price = PriceConfig(
            oracle={
                SYMBOL: [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id=SYMBOL, exponent=None)),
                ]
            },
            mark={
                SYMBOL: [
                    OracleMidAverageConfig(source_type="oracle_mid_average", symbol=f"{DEX}:{SYMBOL}")
                ]
            },
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put(SYMBOL, PriceUpdate("100.0", now - 1.0))
        price_state.hl_mid_state.put(f"{DEX}:{SYMBOL}", PriceUpdate("102.0", now - 10.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "100.0"}
        assert oracle_update.mark == {}


class TestMarkAndExternalPrices:
    """Tests for mark and external price configurations."""

    def test_mark_prices(self):
        """Test mark prices are returned correctly."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = [SYMBOL]
        config.price = PriceConfig(
            oracle={},
            mark={
                SYMBOL: [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_mark", source_id=SYMBOL, exponent=None)),
                ]
            },
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_mark_state.put(SYMBOL, PriceUpdate("99500.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.mark == {f"{DEX}:{SYMBOL}": "99500.0"}

    def test_external_prices(self):
        """Test external prices are returned correctly."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = ["ETH"]
        config.price = PriceConfig(
            oracle={},
            mark={},
            external={
                "ETH": [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id="ETH", exponent=None)),
                ]
            }
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("ETH", PriceUpdate("3000.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.external == {f"{DEX}:ETH": "3000.0"}


class TestMultipleSymbols:
    """Tests for multiple symbols in configuration."""

    def test_multiple_oracle_symbols(self):
        """Test multiple symbols in oracle config."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = ["BTC", "ETH", "SOL"]
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id="BTC", exponent=None)),
                ],
                "ETH": [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id="ETH", exponent=None)),
                ],
                "SOL": [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id="SOL", exponent=None)),
                ],
            },
            mark={},
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("BTC", PriceUpdate("100000.0", now - 1.0))
        price_state.hl_oracle_state.put("ETH", PriceUpdate("3000.0", now - 1.0))
        price_state.hl_oracle_state.put("SOL", PriceUpdate("200.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {
            f"{DEX}:BTC": "100000.0",
            f"{DEX}:ETH": "3000.0",
            f"{DEX}:SOL": "200.0",
        }

    def test_partial_symbols_available(self):
        """Test when only some symbols have fresh prices."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = ["BTC", "ETH"]
        config.price = PriceConfig(
            oracle={
                "BTC": [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id="BTC", exponent=None)),
                ],
                "ETH": [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id="ETH", exponent=None)),
                ],
            },
            mark={},
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put("BTC", PriceUpdate("100000.0", now - 1.0))
        price_state.hl_oracle_state.put("ETH", PriceUpdate("3000.0", now - 10.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {f"{DEX}:BTC": "100000.0"}


class TestPairSourceEdgeCases:
    """Tests for pair source edge cases."""

    def test_pair_source_base_missing(self):
        """Test pair source returns None when base price is missing."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = []
        config.price = PriceConfig(
            oracle={
                SYMBOL: [
                    PairSourceConfig(source_type="pair",
                                     base_source=PriceSource(source_name="lazer", source_id=1, exponent=-8),
                                     quote_source=PriceSource(source_name="lazer", source_id=8, exponent=-8)),
                ]
            },
            mark={},
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.lazer_state.put(8, PriceUpdate("99000000", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {}

    def test_pair_source_quote_missing(self):
        """Test pair source returns None when quote price is missing."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = []
        config.price = PriceConfig(
            oracle={
                SYMBOL: [
                    PairSourceConfig(source_type="pair",
                                     base_source=PriceSource(source_name="lazer", source_id=1, exponent=-8),
                                     quote_source=PriceSource(source_name="lazer", source_id=8, exponent=-8)),
                ]
            },
            mark={},
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.lazer_state.put(1, PriceUpdate("11050000000000", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {}

    def test_pair_source_base_stale(self):
        """Test pair source returns None when base price is stale."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = []
        config.price = PriceConfig(
            oracle={
                SYMBOL: [
                    PairSourceConfig(source_type="pair",
                                     base_source=PriceSource(source_name="lazer", source_id=1, exponent=-8),
                                     quote_source=PriceSource(source_name="lazer", source_id=8, exponent=-8)),
                ]
            },
            mark={},
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.lazer_state.put(1, PriceUpdate("11050000000000", now - 10.0))
        price_state.lazer_state.put(8, PriceUpdate("99000000", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {}


class TestSedaSource:
    """Tests for SEDA price source."""

    def test_seda_source(self):
        """Test SEDA source returns price correctly."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = []
        config.price = PriceConfig(
            oracle={
                "CUSTOM": [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="seda", source_id="custom_feed", exponent=None)),
                ]
            },
            mark={},
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.seda_state.put("custom_feed", PriceUpdate("42.5", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {f"{DEX}:CUSTOM": "42.5"}


class TestExponentConversion:
    """Tests for exponent conversion in price sources."""

    def test_positive_exponent(self):
        """Test price conversion with positive exponent.

        Formula: price / (10 ** -exponent)
        With exponent=2 and price=100: 100 / (10 ** -2) = 100 / 0.01 = 10000.0
        """
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = []
        config.price = PriceConfig(
            oracle={
                SYMBOL: [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="lazer", source_id=1, exponent=2)),
                ]
            },
            mark={},
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.lazer_state.put(1, PriceUpdate("100", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "10000.0"}

    def test_negative_exponent(self):
        """Test price conversion with negative exponent."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = []
        config.price = PriceConfig(
            oracle={
                SYMBOL: [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="lazer", source_id=1, exponent=-8)),
                ]
            },
            mark={},
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.lazer_state.put(1, PriceUpdate("10000000000000", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "100000.0"}

    def test_no_exponent(self):
        """Test price pass-through with no exponent."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = [SYMBOL]
        config.price = PriceConfig(
            oracle={
                SYMBOL: [
                    SingleSourceConfig(source_type="single", source=PriceSource(source_name="hl_oracle", source_id=SYMBOL, exponent=None)),
                ]
            },
            mark={},
            external={}
        )

        price_state = PriceState(config)
        now = time.time()
        price_state.hl_oracle_state.put(SYMBOL, PriceUpdate("100000.0", now - 1.0))

        oracle_update = price_state.get_all_prices()
        assert oracle_update.oracle == {f"{DEX}:{SYMBOL}": "100000.0"}


class TestInvalidSourceConfig:
    """Tests for invalid source configuration handling."""

    def test_invalid_source_type_raises(self):
        """Test that invalid source type raises ValueError."""
        config: Config = Config.model_construct()
        config.stale_price_threshold_seconds = 5
        config.hyperliquid = HyperliquidConfig.model_construct()
        config.hyperliquid.market_name = DEX
        config.hyperliquid.asset_context_symbols = []
        config.price = PriceConfig(oracle={}, mark={}, external={})

        price_state = PriceState(config)

        class InvalidConfig:
            source_type = "invalid"

        with pytest.raises(ValueError):
            price_state.get_price(InvalidConfig(), OracleUpdate({}, {}, {}))
