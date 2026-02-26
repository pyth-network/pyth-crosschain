"""Tests for listener message parsing functions."""

import time

from pusher.hermes_listener import HermesListener
from pusher.hyperliquid_listener import HyperliquidListener
from pusher.lazer_listener import LazerListener
from pusher.price_state import PriceSourceState


class TestHermesListenerParsing:
    """Tests for HermesListener.parse_hermes_message()."""

    def test_parse_price_update_message(self):
        """parse_hermes_message correctly parses a price_update message."""
        hermes_state = PriceSourceState("hermes")

        class MockConfig:
            class hermes:
                hermes_urls = ["wss://example.com"]  # noqa: RUF012
                feed_ids = ["abc123"]  # noqa: RUF012
                stop_after_attempt = 5

        listener = HermesListener(MockConfig(), hermes_state)

        message = {
            "type": "price_update",
            "price_feed": {
                "id": "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
                "price": {
                    "price": "6500000000000",
                    "expo": -8,
                    "publish_time": 1700000000,
                },
            },
        }

        listener.parse_hermes_message(message)

        update = hermes_state.get(
            "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
        )
        assert update is not None
        assert update.price == "6500000000000"
        assert update.timestamp == 1700000000

    def test_parse_non_price_update_message(self):
        """parse_hermes_message ignores non-price_update messages."""
        hermes_state = PriceSourceState("hermes")

        class MockConfig:
            class hermes:
                hermes_urls = ["wss://example.com"]  # noqa: RUF012
                feed_ids = ["abc123"]  # noqa: RUF012
                stop_after_attempt = 5

        listener = HermesListener(MockConfig(), hermes_state)

        message = {"type": "subscription_response", "data": {}}

        listener.parse_hermes_message(message)

        assert hermes_state.state == {}

    def test_parse_message_without_type(self):
        """parse_hermes_message handles messages without type field."""
        hermes_state = PriceSourceState("hermes")

        class MockConfig:
            class hermes:
                hermes_urls = ["wss://example.com"]  # noqa: RUF012
                feed_ids = ["abc123"]  # noqa: RUF012
                stop_after_attempt = 5

        listener = HermesListener(MockConfig(), hermes_state)

        message = {"data": "something"}

        listener.parse_hermes_message(message)

        assert hermes_state.state == {}

    def test_parse_malformed_message(self):
        """parse_hermes_message handles malformed messages gracefully."""
        hermes_state = PriceSourceState("hermes")

        class MockConfig:
            class hermes:
                hermes_urls = ["wss://example.com"]  # noqa: RUF012
                feed_ids = ["abc123"]  # noqa: RUF012
                stop_after_attempt = 5

        listener = HermesListener(MockConfig(), hermes_state)

        message = {"type": "price_update"}

        listener.parse_hermes_message(message)

        assert hermes_state.state == {}

    def test_get_subscribe_request(self):
        """get_subscribe_request returns correct subscription format."""
        hermes_state = PriceSourceState("hermes")

        class MockConfig:
            class hermes:
                hermes_urls = ["wss://example.com"]  # noqa: RUF012
                feed_ids = ["feed1", "feed2"]  # noqa: RUF012
                stop_after_attempt = 5

        listener = HermesListener(MockConfig(), hermes_state)

        request = listener.get_subscribe_request()

        assert request["type"] == "subscribe"
        assert request["ids"] == ["feed1", "feed2"]
        assert request["verbose"] is False
        assert request["binary"] is True


class TestLazerListenerParsing:
    """Tests for LazerListener.parse_lazer_message()."""

    def test_parse_stream_updated_message(self):
        """parse_lazer_message correctly parses a streamUpdated message."""
        lazer_state = PriceSourceState("lazer")

        class MockConfig:
            class lazer:
                lazer_urls = ["wss://example.com"]  # noqa: RUF012
                lazer_api_key = "test_key"
                feed_ids = [1, 8]  # noqa: RUF012
                stop_after_attempt = 5

        listener = LazerListener(MockConfig(), lazer_state)

        message = {
            "type": "streamUpdated",
            "parsed": {
                "timestampUs": "1700000000000000",
                "priceFeeds": [
                    {"priceFeedId": 1, "price": "6500000000000"},
                    {"priceFeedId": 8, "price": "100000000"},
                ],
            },
        }

        listener.parse_lazer_message(message)

        update1 = lazer_state.get(1)
        assert update1 is not None
        assert update1.price == "6500000000000"
        assert update1.timestamp == 1700000000.0

        update8 = lazer_state.get(8)
        assert update8 is not None
        assert update8.price == "100000000"

    def test_parse_non_stream_updated_message(self):
        """parse_lazer_message ignores non-streamUpdated messages."""
        lazer_state = PriceSourceState("lazer")

        class MockConfig:
            class lazer:
                lazer_urls = ["wss://example.com"]  # noqa: RUF012
                lazer_api_key = "test_key"
                feed_ids = [1]  # noqa: RUF012
                stop_after_attempt = 5

        listener = LazerListener(MockConfig(), lazer_state)

        message = {"type": "subscribed", "subscriptionId": 1}

        listener.parse_lazer_message(message)

        assert lazer_state.state == {}

    def test_parse_message_without_type(self):
        """parse_lazer_message handles messages without type field."""
        lazer_state = PriceSourceState("lazer")

        class MockConfig:
            class lazer:
                lazer_urls = ["wss://example.com"]  # noqa: RUF012
                lazer_api_key = "test_key"
                feed_ids = [1]  # noqa: RUF012
                stop_after_attempt = 5

        listener = LazerListener(MockConfig(), lazer_state)

        message = {"data": "something"}

        listener.parse_lazer_message(message)

        assert lazer_state.state == {}

    def test_parse_malformed_message(self):
        """parse_lazer_message handles malformed messages gracefully."""
        lazer_state = PriceSourceState("lazer")

        class MockConfig:
            class lazer:
                lazer_urls = ["wss://example.com"]  # noqa: RUF012
                lazer_api_key = "test_key"
                feed_ids = [1]  # noqa: RUF012
                stop_after_attempt = 5

        listener = LazerListener(MockConfig(), lazer_state)

        message = {"type": "streamUpdated"}

        listener.parse_lazer_message(message)

        assert lazer_state.state == {}

    def test_parse_partial_price_feeds(self):
        """parse_lazer_message handles price feeds with missing fields."""
        lazer_state = PriceSourceState("lazer")

        class MockConfig:
            class lazer:
                lazer_urls = ["wss://example.com"]  # noqa: RUF012
                lazer_api_key = "test_key"
                feed_ids = [1, 2]  # noqa: RUF012
                stop_after_attempt = 5

        listener = LazerListener(MockConfig(), lazer_state)

        message = {
            "type": "streamUpdated",
            "parsed": {
                "timestampUs": "1700000000000000",
                "priceFeeds": [
                    {"priceFeedId": 1, "price": "6500000000000"},
                    {"priceFeedId": 2},
                    {"price": "100"},
                ],
            },
        }

        listener.parse_lazer_message(message)

        update1 = lazer_state.get(1)
        assert update1 is not None
        assert update1.price == "6500000000000"

        assert lazer_state.get(2) is None

    def test_get_subscribe_request(self):
        """get_subscribe_request returns correct subscription format."""
        lazer_state = PriceSourceState("lazer")

        class MockConfig:
            class lazer:
                lazer_urls = ["wss://example.com"]  # noqa: RUF012
                lazer_api_key = "test_key"
                feed_ids = [1, 8]  # noqa: RUF012
                stop_after_attempt = 5

        listener = LazerListener(MockConfig(), lazer_state)

        request = listener.get_subscribe_request(1)

        assert request["type"] == "subscribe"
        assert request["subscriptionId"] == 1
        assert request["priceFeedIds"] == [1, 8]
        assert request["deliveryFormat"] == "json"
        assert request["channel"] == "fixed_rate@200ms"

    def test_get_auth_headers(self):
        """get_auth_headers returns correct authorization header."""
        lazer_state = PriceSourceState("lazer")

        class MockConfig:
            class lazer:
                lazer_urls = ["wss://example.com"]  # noqa: RUF012
                lazer_api_key = "my_secret_key"
                feed_ids = [1]  # noqa: RUF012
                stop_after_attempt = 5

        listener = LazerListener(MockConfig(), lazer_state)

        headers = listener.get_auth_headers()

        assert headers == {"Authorization": "Bearer my_secret_key"}


class TestHyperliquidListenerParsing:
    """Tests for HyperliquidListener parsing methods."""

    def test_parse_active_asset_ctx_update(self):
        """parse_hyperliquid_active_asset_ctx_update correctly parses message."""
        hl_oracle_state = PriceSourceState("hl_oracle")
        hl_mark_state = PriceSourceState("hl_mark")
        hl_mid_state = PriceSourceState("hl_mid")

        class MockConfig:
            class hyperliquid:
                market_name = "pyth"
                hyperliquid_ws_urls = ["wss://example.com"]  # noqa: RUF012
                asset_context_symbols = ["BTC"]  # noqa: RUF012
                ws_ping_interval = 20
                stop_after_attempt = 5

        listener = HyperliquidListener(
            MockConfig(), hl_oracle_state, hl_mark_state, hl_mid_state
        )

        now = time.time()
        message = {
            "channel": "activeAssetCtx",
            "data": {
                "coin": "BTC",
                "ctx": {
                    "oraclePx": "65000.0",
                    "markPx": "65100.0",
                },
            },
        }

        listener.parse_hyperliquid_active_asset_ctx_update(message, now)

        oracle_update = hl_oracle_state.get("BTC")
        assert oracle_update is not None
        assert oracle_update.price == "65000.0"
        assert oracle_update.timestamp == now

        mark_update = hl_mark_state.get("BTC")
        assert mark_update is not None
        assert mark_update.price == "65100.0"

    def test_parse_active_asset_ctx_malformed(self):
        """parse_hyperliquid_active_asset_ctx_update handles malformed messages."""
        hl_oracle_state = PriceSourceState("hl_oracle")
        hl_mark_state = PriceSourceState("hl_mark")
        hl_mid_state = PriceSourceState("hl_mid")

        class MockConfig:
            class hyperliquid:
                market_name = "pyth"
                hyperliquid_ws_urls = ["wss://example.com"]  # noqa: RUF012
                asset_context_symbols = ["BTC"]  # noqa: RUF012
                ws_ping_interval = 20
                stop_after_attempt = 5

        listener = HyperliquidListener(
            MockConfig(), hl_oracle_state, hl_mark_state, hl_mid_state
        )

        now = time.time()
        message = {"channel": "activeAssetCtx", "data": {}}

        listener.parse_hyperliquid_active_asset_ctx_update(message, now)

        assert hl_oracle_state.state == {}

    def test_parse_all_mids_update(self):
        """parse_hyperliquid_all_mids_update correctly parses message."""
        hl_oracle_state = PriceSourceState("hl_oracle")
        hl_mark_state = PriceSourceState("hl_mark")
        hl_mid_state = PriceSourceState("hl_mid")

        class MockConfig:
            class hyperliquid:
                market_name = "pyth"
                hyperliquid_ws_urls = ["wss://example.com"]  # noqa: RUF012
                asset_context_symbols = []  # noqa: RUF012
                ws_ping_interval = 20
                stop_after_attempt = 5

        listener = HyperliquidListener(
            MockConfig(), hl_oracle_state, hl_mark_state, hl_mid_state
        )

        now = time.time()
        message = {
            "channel": "allMids",
            "data": {
                "mids": {
                    "pyth:BTC": "65050.0",
                    "pyth:ETH": "3500.0",
                }
            },
        }

        listener.parse_hyperliquid_all_mids_update(message, now)

        btc_update = hl_mid_state.get("pyth:BTC")
        assert btc_update is not None
        assert btc_update.price == "65050.0"
        assert btc_update.timestamp == now

        eth_update = hl_mid_state.get("pyth:ETH")
        assert eth_update is not None
        assert eth_update.price == "3500.0"

    def test_parse_all_mids_malformed(self):
        """parse_hyperliquid_all_mids_update handles malformed messages."""
        hl_oracle_state = PriceSourceState("hl_oracle")
        hl_mark_state = PriceSourceState("hl_mark")
        hl_mid_state = PriceSourceState("hl_mid")

        class MockConfig:
            class hyperliquid:
                market_name = "pyth"
                hyperliquid_ws_urls = ["wss://example.com"]  # noqa: RUF012
                asset_context_symbols = []  # noqa: RUF012
                ws_ping_interval = 20
                stop_after_attempt = 5

        listener = HyperliquidListener(
            MockConfig(), hl_oracle_state, hl_mark_state, hl_mid_state
        )

        now = time.time()
        message = {"channel": "allMids", "data": {}}

        listener.parse_hyperliquid_all_mids_update(message, now)

        assert hl_mid_state.state == {}

    def test_get_subscribe_request(self):
        """get_subscribe_request returns correct subscription format."""
        hl_oracle_state = PriceSourceState("hl_oracle")
        hl_mark_state = PriceSourceState("hl_mark")
        hl_mid_state = PriceSourceState("hl_mid")

        class MockConfig:
            class hyperliquid:
                market_name = "pyth"
                hyperliquid_ws_urls = ["wss://example.com"]  # noqa: RUF012
                asset_context_symbols = ["BTC", "ETH"]  # noqa: RUF012
                ws_ping_interval = 20
                stop_after_attempt = 5

        listener = HyperliquidListener(
            MockConfig(), hl_oracle_state, hl_mark_state, hl_mid_state
        )

        request = listener.get_subscribe_request("BTC")

        assert request["method"] == "subscribe"
        assert request["subscription"]["type"] == "activeAssetCtx"
        assert request["subscription"]["coin"] == "BTC"
