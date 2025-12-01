import datetime
import time

from pusher.config import Config, LazerConfig, HermesConfig, HyperliquidConfig, SedaConfig, SedaFeedConfig
from pusher.hermes_listener import HermesListener
from pusher.hyperliquid_listener import HyperliquidListener
from pusher.lazer_listener import LazerListener
from pusher.seda_listener import SedaListener
from pusher.price_state import PriceSourceState


def get_base_config():
    """Create a base config for testing listeners."""
    config: Config = Config.model_construct()
    config.hyperliquid = HyperliquidConfig.model_construct()
    config.hyperliquid.market_name = "pyth"
    config.hyperliquid.hyperliquid_ws_urls = ["wss://test.example.com/ws"]
    config.hyperliquid.asset_context_symbols = ["BTC", "ETH"]
    config.lazer = LazerConfig.model_construct()
    config.lazer.lazer_urls = ["wss://lazer.example.com"]
    config.lazer.lazer_api_key = "test-api-key"
    config.lazer.feed_ids = [1, 8]
    config.hermes = HermesConfig.model_construct()
    config.hermes.hermes_urls = ["wss://hermes.example.com"]
    config.hermes.feed_ids = ["feed1", "feed2"]
    return config


class TestHermesListener:
    """Tests for HermesListener message parsing."""

    def test_get_subscribe_request(self):
        """Test subscribe request format."""
        config = get_base_config()
        hermes_state = PriceSourceState("hermes")
        listener = HermesListener(config, hermes_state)

        request = listener.get_subscribe_request()

        assert request["type"] == "subscribe"
        assert request["ids"] == ["feed1", "feed2"]
        assert request["verbose"] is False
        assert request["binary"] is True
        assert request["allow_out_of_order"] is False
        assert request["ignore_invalid_price_ids"] is False

    def test_parse_hermes_message_valid(self):
        """Test parsing valid Hermes price update message."""
        config = get_base_config()
        hermes_state = PriceSourceState("hermes")
        listener = HermesListener(config, hermes_state)

        message = {
            "type": "price_update",
            "price_feed": {
                "id": "test_feed_id",
                "price": {
                    "price": "12345678",
                    "expo": -8,
                    "publish_time": 1700000000
                }
            }
        }

        listener.parse_hermes_message(message)

        update = hermes_state.get("test_feed_id")
        assert update is not None
        assert update.price == "12345678"

    def test_parse_hermes_message_non_price_update(self):
        """Test that non-price_update messages are ignored."""
        config = get_base_config()
        hermes_state = PriceSourceState("hermes")
        listener = HermesListener(config, hermes_state)

        message = {
            "type": "subscription_response",
            "data": {}
        }

        listener.parse_hermes_message(message)

        assert hermes_state.state == {}

    def test_parse_hermes_message_missing_type(self):
        """Test that messages without type are ignored."""
        config = get_base_config()
        hermes_state = PriceSourceState("hermes")
        listener = HermesListener(config, hermes_state)

        message = {
            "price_feed": {
                "id": "test_feed_id",
                "price": {"price": "12345678"}
            }
        }

        listener.parse_hermes_message(message)

        assert hermes_state.state == {}

    def test_parse_hermes_message_malformed(self):
        """Test that malformed messages don't crash."""
        config = get_base_config()
        hermes_state = PriceSourceState("hermes")
        listener = HermesListener(config, hermes_state)

        message = {
            "type": "price_update",
            "invalid_key": "invalid_value"
        }

        listener.parse_hermes_message(message)

        assert hermes_state.state == {}


class TestLazerListener:
    """Tests for LazerListener message parsing."""

    def test_get_subscribe_request(self):
        """Test subscribe request format."""
        config = get_base_config()
        lazer_state = PriceSourceState("lazer")
        listener = LazerListener(config, lazer_state)

        request = listener.get_subscribe_request(subscription_id=42)

        assert request["type"] == "subscribe"
        assert request["subscriptionId"] == 42
        assert request["priceFeedIds"] == [1, 8]
        assert request["properties"] == ["price"]
        assert request["formats"] == []
        assert request["deliveryFormat"] == "json"
        assert request["channel"] == "fixed_rate@200ms"
        assert request["parsed"] is True
        assert request["jsonBinaryEncoding"] == "base64"

    def test_parse_lazer_message_valid(self):
        """Test parsing valid Lazer streamUpdated message."""
        config = get_base_config()
        lazer_state = PriceSourceState("lazer")
        listener = LazerListener(config, lazer_state)

        message = {
            "type": "streamUpdated",
            "parsed": {
                "priceFeeds": [
                    {"priceFeedId": 1, "price": "11050000000000"},
                    {"priceFeedId": 8, "price": "99000000"}
                ]
            }
        }

        listener.parse_lazer_message(message)

        update1 = lazer_state.get(1)
        assert update1 is not None
        assert update1.price == "11050000000000"

        update8 = lazer_state.get(8)
        assert update8 is not None
        assert update8.price == "99000000"

    def test_parse_lazer_message_non_stream_updated(self):
        """Test that non-streamUpdated messages are ignored."""
        config = get_base_config()
        lazer_state = PriceSourceState("lazer")
        listener = LazerListener(config, lazer_state)

        message = {
            "type": "subscribed",
            "subscriptionId": 1
        }

        listener.parse_lazer_message(message)

        assert lazer_state.state == {}

    def test_parse_lazer_message_missing_feed_id(self):
        """Test that feeds without priceFeedId are skipped."""
        config = get_base_config()
        lazer_state = PriceSourceState("lazer")
        listener = LazerListener(config, lazer_state)

        message = {
            "type": "streamUpdated",
            "parsed": {
                "priceFeeds": [
                    {"price": "11050000000000"},
                    {"priceFeedId": 8, "price": "99000000"}
                ]
            }
        }

        listener.parse_lazer_message(message)

        assert lazer_state.get(1) is None
        update8 = lazer_state.get(8)
        assert update8 is not None
        assert update8.price == "99000000"

    def test_parse_lazer_message_missing_price(self):
        """Test that feeds without price are skipped."""
        config = get_base_config()
        lazer_state = PriceSourceState("lazer")
        listener = LazerListener(config, lazer_state)

        message = {
            "type": "streamUpdated",
            "parsed": {
                "priceFeeds": [
                    {"priceFeedId": 1},
                    {"priceFeedId": 8, "price": "99000000"}
                ]
            }
        }

        listener.parse_lazer_message(message)

        assert lazer_state.get(1) is None
        update8 = lazer_state.get(8)
        assert update8 is not None

    def test_parse_lazer_message_malformed(self):
        """Test that malformed messages don't crash."""
        config = get_base_config()
        lazer_state = PriceSourceState("lazer")
        listener = LazerListener(config, lazer_state)

        message = {
            "type": "streamUpdated",
            "invalid_key": "invalid_value"
        }

        listener.parse_lazer_message(message)

        assert lazer_state.state == {}


class TestHyperliquidListener:
    """Tests for HyperliquidListener message parsing."""

    def test_get_subscribe_request(self):
        """Test subscribe request format."""
        config = get_base_config()
        hl_oracle_state = PriceSourceState("hl_oracle")
        hl_mark_state = PriceSourceState("hl_mark")
        hl_mid_state = PriceSourceState("hl_mid")
        listener = HyperliquidListener(config, hl_oracle_state, hl_mark_state, hl_mid_state)

        request = listener.get_subscribe_request("BTC")

        assert request["method"] == "subscribe"
        assert request["subscription"]["type"] == "activeAssetCtx"
        assert request["subscription"]["coin"] == "BTC"

    def test_parse_active_asset_ctx_update(self):
        """Test parsing activeAssetCtx update message."""
        config = get_base_config()
        hl_oracle_state = PriceSourceState("hl_oracle")
        hl_mark_state = PriceSourceState("hl_mark")
        hl_mid_state = PriceSourceState("hl_mid")
        listener = HyperliquidListener(config, hl_oracle_state, hl_mark_state, hl_mid_state)

        message = {
            "channel": "activeAssetCtx",
            "data": {
                "coin": "BTC",
                "ctx": {
                    "oraclePx": "100000.0",
                    "markPx": "99500.0"
                }
            }
        }

        listener.parse_hyperliquid_active_asset_ctx_update(message)

        oracle_update = hl_oracle_state.get("BTC")
        assert oracle_update is not None
        assert oracle_update.price == "100000.0"

        mark_update = hl_mark_state.get("BTC")
        assert mark_update is not None
        assert mark_update.price == "99500.0"

    def test_parse_active_asset_ctx_update_malformed(self):
        """Test that malformed activeAssetCtx messages don't crash."""
        config = get_base_config()
        hl_oracle_state = PriceSourceState("hl_oracle")
        hl_mark_state = PriceSourceState("hl_mark")
        hl_mid_state = PriceSourceState("hl_mid")
        listener = HyperliquidListener(config, hl_oracle_state, hl_mark_state, hl_mid_state)

        message = {
            "channel": "activeAssetCtx",
            "data": {}
        }

        listener.parse_hyperliquid_active_asset_ctx_update(message)

        assert hl_oracle_state.state == {}
        assert hl_mark_state.state == {}

    def test_parse_all_mids_update(self):
        """Test parsing allMids update message."""
        config = get_base_config()
        hl_oracle_state = PriceSourceState("hl_oracle")
        hl_mark_state = PriceSourceState("hl_mark")
        hl_mid_state = PriceSourceState("hl_mid")
        listener = HyperliquidListener(config, hl_oracle_state, hl_mark_state, hl_mid_state)

        message = {
            "channel": "allMids",
            "data": {
                "mids": {
                    "pyth:BTC": "100250.0",
                    "pyth:ETH": "3050.0"
                }
            }
        }

        listener.parse_hyperliquid_all_mids_update(message)

        btc_mid = hl_mid_state.get("pyth:BTC")
        assert btc_mid is not None
        assert btc_mid.price == "100250.0"

        eth_mid = hl_mid_state.get("pyth:ETH")
        assert eth_mid is not None
        assert eth_mid.price == "3050.0"

    def test_parse_all_mids_update_malformed(self):
        """Test that malformed allMids messages don't crash."""
        config = get_base_config()
        hl_oracle_state = PriceSourceState("hl_oracle")
        hl_mark_state = PriceSourceState("hl_mark")
        hl_mid_state = PriceSourceState("hl_mid")
        listener = HyperliquidListener(config, hl_oracle_state, hl_mark_state, hl_mid_state)

        message = {
            "channel": "allMids",
            "data": {}
        }

        listener.parse_hyperliquid_all_mids_update(message)

        assert hl_mid_state.state == {}

    def test_parse_all_mids_update_empty_mids(self):
        """Test parsing allMids with empty mids dict."""
        config = get_base_config()
        hl_oracle_state = PriceSourceState("hl_oracle")
        hl_mark_state = PriceSourceState("hl_mark")
        hl_mid_state = PriceSourceState("hl_mid")
        listener = HyperliquidListener(config, hl_oracle_state, hl_mark_state, hl_mid_state)

        message = {
            "channel": "allMids",
            "data": {
                "mids": {}
            }
        }

        listener.parse_hyperliquid_all_mids_update(message)

        assert hl_mid_state.state == {}


class TestSedaListener:
    """Tests for SedaListener message parsing."""

    def test_parse_seda_message_valid(self):
        """Test parsing valid SEDA message."""
        seda_state = PriceSourceState("seda")

        class MockSedaListener:
            def __init__(self):
                self.seda_state = seda_state

        listener = MockSedaListener()

        message = {
            "data": {
                "result": '{"composite_rate": "42.5", "timestamp": "2024-01-15T12:00:00+00:00"}'
            }
        }

        SedaListener._parse_seda_message(listener, "custom_feed", message)

        update = seda_state.get("custom_feed")
        assert update is not None
        assert update.price == "42.5"
        expected_timestamp = datetime.datetime.fromisoformat("2024-01-15T12:00:00+00:00").timestamp()
        assert update.timestamp == expected_timestamp

    def test_parse_seda_message_different_timestamp_format(self):
        """Test parsing SEDA message with different timestamp format."""
        seda_state = PriceSourceState("seda")

        class MockSedaListener:
            def __init__(self):
                self.seda_state = seda_state

        listener = MockSedaListener()

        message = {
            "data": {
                "result": '{"composite_rate": "100.25", "timestamp": "2024-06-20T15:30:45.123456+00:00"}'
            }
        }

        SedaListener._parse_seda_message(listener, "another_feed", message)

        update = seda_state.get("another_feed")
        assert update is not None
        assert update.price == "100.25"

    def test_parse_seda_message_numeric_rate(self):
        """Test parsing SEDA message with numeric composite_rate."""
        seda_state = PriceSourceState("seda")

        class MockSedaListener:
            def __init__(self):
                self.seda_state = seda_state

        listener = MockSedaListener()

        message = {
            "data": {
                "result": '{"composite_rate": 123.456, "timestamp": "2024-01-15T12:00:00+00:00"}'
            }
        }

        SedaListener._parse_seda_message(listener, "numeric_feed", message)

        update = seda_state.get("numeric_feed")
        assert update is not None
        assert update.price == 123.456
