"""Tests for Publisher utility methods."""

from pusher.publisher import PushErrorReason


class TestConstructMarkPxs:
    """Tests for Publisher.construct_mark_pxs() method."""

    def test_empty_mark_pxs(self):
        """Empty mark_pxs returns empty list."""
        from pusher.publisher import Publisher

        result = Publisher.construct_mark_pxs(None, {})
        assert result == []

    def test_single_price_per_symbol(self):
        """Single price per symbol creates list with one dict."""
        from pusher.publisher import Publisher

        mark_pxs = {"pyth:BTC": "65000.0", "pyth:ETH": "3500.0"}
        result = Publisher.construct_mark_pxs(None, mark_pxs)

        assert len(result) == 1
        assert result[0] == {"pyth:BTC": "65000.0", "pyth:ETH": "3500.0"}

    def test_dual_prices_session_ema(self):
        """Dual prices (session_ema) creates list with two dicts."""
        from pusher.publisher import Publisher

        mark_pxs = {"pyth:BTC": ["65000.0", "64999.5"]}
        result = Publisher.construct_mark_pxs(None, mark_pxs)

        assert len(result) == 2
        assert result[0] == {"pyth:BTC": "65000.0"}
        assert result[1] == {"pyth:BTC": "64999.5"}

    def test_mixed_single_and_dual_prices(self):
        """Mixed single and dual prices handled correctly."""
        from pusher.publisher import Publisher

        mark_pxs = {
            "pyth:BTC": ["65000.0", "64999.5"],
            "pyth:ETH": "3500.0",
        }
        result = Publisher.construct_mark_pxs(None, mark_pxs)

        assert len(result) == 2
        assert result[0]["pyth:BTC"] == "65000.0"
        assert result[0]["pyth:ETH"] == "3500.0"
        assert result[1]["pyth:BTC"] == "64999.5"
        assert "pyth:ETH" not in result[1]

    def test_multiple_dual_price_symbols(self):
        """Multiple symbols with dual prices handled correctly."""
        from pusher.publisher import Publisher

        mark_pxs = {
            "pyth:BTC": ["65000.0", "64999.5"],
            "pyth:SPY": ["450.0", "449.5"],
        }
        result = Publisher.construct_mark_pxs(None, mark_pxs)

        assert len(result) == 2
        assert result[0]["pyth:BTC"] == "65000.0"
        assert result[0]["pyth:SPY"] == "450.0"
        assert result[1]["pyth:BTC"] == "64999.5"
        assert result[1]["pyth:SPY"] == "449.5"


class TestGetErrorReason:
    """Tests for Publisher._get_error_reason() method."""

    def test_rate_limit_error(self):
        """Rate limit error is correctly identified."""
        from pusher.publisher import Publisher

        response = {
            "status": "err",
            "response": "Oracle price update too often. Please wait 2.5 seconds.",
        }
        result = Publisher._get_error_reason(None, response)
        assert result == PushErrorReason.RATE_LIMIT

    def test_user_limit_error(self):
        """User limit error is correctly identified."""
        from pusher.publisher import Publisher

        response = {
            "status": "err",
            "response": "Too many cumulative requests. Please try again later.",
        }
        result = Publisher._get_error_reason(None, response)
        assert result == PushErrorReason.USER_LIMIT

    def test_invalid_nonce_error(self):
        """Invalid nonce error is correctly identified."""
        from pusher.publisher import Publisher

        response = {"status": "err", "response": "Invalid nonce: already used"}
        result = Publisher._get_error_reason(None, response)
        assert result == PushErrorReason.INVALID_NONCE

    def test_missing_external_perp_pxs_error(self):
        """Missing external perp pxs error is correctly identified."""
        from pusher.publisher import Publisher

        response = {
            "status": "err",
            "response": "externalPerpPxs missing perp: pyth:BTC",
        }
        result = Publisher._get_error_reason(None, response)
        assert result == PushErrorReason.MISSING_EXTERNAL_PERP_PXS

    def test_invalid_deployer_account_error(self):
        """Invalid deployer account error is correctly identified."""
        from pusher.publisher import Publisher

        response = {
            "status": "err",
            "response": "Invalid perp deployer or sub-deployer for this market",
        }
        result = Publisher._get_error_reason(None, response)
        assert result == PushErrorReason.INVALID_DEPLOYER_ACCOUNT

    def test_account_does_not_exist_error(self):
        """Account does not exist error is correctly identified."""
        from pusher.publisher import Publisher

        response = {
            "status": "err",
            "response": "User or API Wallet 0x123... does not exist",
        }
        result = Publisher._get_error_reason(None, response)
        assert result == PushErrorReason.ACCOUNT_DOES_NOT_EXIST

    def test_invalid_dex_error(self):
        """Invalid DEX error is correctly identified."""
        from pusher.publisher import Publisher

        response = {"status": "err", "response": "Invalid perp DEX: unknown_market"}
        result = Publisher._get_error_reason(None, response)
        assert result == PushErrorReason.INVALID_DEX

    def test_unknown_error(self):
        """Unknown error returns UNKNOWN reason."""
        from pusher.publisher import Publisher

        response = {"status": "err", "response": "Some unexpected error message"}
        result = Publisher._get_error_reason(None, response)
        assert result == PushErrorReason.UNKNOWN

    def test_empty_response(self):
        """Empty response returns None."""
        from pusher.publisher import Publisher

        response = {"status": "err"}
        result = Publisher._get_error_reason(None, response)
        assert result is None

    def test_non_string_response(self):
        """Non-string response returns UNKNOWN."""
        from pusher.publisher import Publisher

        response = {"status": "err", "response": {"error": "something"}}
        result = Publisher._get_error_reason(None, response)
        assert result == PushErrorReason.UNKNOWN


class TestPushErrorReason:
    """Tests for PushErrorReason enum."""

    def test_all_error_reasons_defined(self):
        """All expected error reasons are defined."""
        assert PushErrorReason.RATE_LIMIT == "rate_limit"
        assert PushErrorReason.USER_LIMIT == "user_limit"
        assert PushErrorReason.INTERNAL_ERROR == "internal_error"
        assert PushErrorReason.INVALID_NONCE == "invalid_nonce"
        assert PushErrorReason.INVALID_DEPLOYER_ACCOUNT == "invalid_deployer_account"
        assert PushErrorReason.ACCOUNT_DOES_NOT_EXIST == "account_does_not_exist"
        assert PushErrorReason.MISSING_EXTERNAL_PERP_PXS == "missing_external_perp_pxs"
        assert PushErrorReason.INVALID_DEX == "invalid_dex"
        assert PushErrorReason.UNKNOWN == "unknown"

    def test_error_reason_string_comparison(self):
        """Error reasons can be compared as strings."""
        assert PushErrorReason.RATE_LIMIT == "rate_limit"
        assert str(PushErrorReason.RATE_LIMIT) == "rate_limit"
