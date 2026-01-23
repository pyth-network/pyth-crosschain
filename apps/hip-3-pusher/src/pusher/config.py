"""
Configuration models for HIP-3 Pusher.

This module defines the pydantic models that parse the TOML configuration file.
See README.md for detailed documentation on each configuration option.
"""

from typing import Literal, Self

from hyperliquid.utils.constants import MAINNET_API_URL, TESTNET_API_URL
from pydantic import BaseModel, FilePath, model_validator

# Interval of time after which we'll cycle websocket connections
STALE_TIMEOUT_SECONDS: int = 5
# This is the interval to call userRateLimit. Low-frequency as it's just for long-term metrics.
USER_LIMIT_INTERVAL_SECONDS: int = 1800
# HL has an application-level ping-pong that should be handled on the order of a minute.
HYPERLIQUID_WS_PING_INTERVAL_SECONDS: int = 20
# Number of websocket failures before we crash/restart the app.
DEFAULT_STOP_AFTER_ATTEMPT: int = 20


class KMSConfig(BaseModel):
    """AWS KMS signing configuration."""

    enable_kms: bool
    aws_kms_key_id_path: FilePath | None = None


class MultisigConfig(BaseModel):
    """Multisig wallet configuration for oracle updates."""

    enable_multisig: bool
    multisig_address: str | None = None


class LazerConfig(BaseModel):
    """
    Pyth Lazer WebSocket feed configuration.

    Lazer provides ultra-low-latency price feeds. Feed IDs are numeric (e.g., 1=BTC, 8=USDT).
    Multiple URLs provide redundancy - the pusher subscribes to all simultaneously.
    """

    lazer_urls: list[str]
    lazer_api_key: str
    feed_ids: list[int]  # Numeric Lazer feed IDs (different from Hermes hex IDs)
    stop_after_attempt: int = DEFAULT_STOP_AFTER_ATTEMPT


class HermesConfig(BaseModel):
    """
    Pythnet/Hermes WebSocket feed configuration.

    Hermes provides traditional Pyth price feeds. Feed IDs are 64-character hex strings.
    Typically used as a fallback to Lazer in the price waterfall.
    """

    hermes_urls: list[str]
    feed_ids: list[
        str
    ]  # 64-char hex Pythnet feed IDs (different from Lazer numeric IDs)
    stop_after_attempt: int = DEFAULT_STOP_AFTER_ATTEMPT


class HyperliquidConfig(BaseModel):
    """
    Hyperliquid connection and publishing configuration.

    Configures both the WebSocket listeners (for reference prices) and the
    publisher (for sending oracle updates via the setOracle API).
    """

    hyperliquid_ws_urls: list[str]
    push_urls: list[str] | None = (
        None  # Override API URLs for publishing (defaults based on use_testnet)
    )
    market_name: str  # Your HIP-3 market name (must match deployed market)
    asset_context_symbols: list[
        str
    ]  # Symbols to subscribe to (e.g., ["BTC", "pyth:BTC"])
    use_testnet: bool
    oracle_pusher_key_path: FilePath | None = None
    publish_interval: float  # Seconds between publish attempts (HL rate limit is 2.5s)
    publish_timeout: float
    enable_publish: bool  # Master switch - set false for dry-run testing
    duplicate_mark_price: bool = False  # Legacy: duplicate oracle as mark price
    user_limit_interval: int = USER_LIMIT_INTERVAL_SECONDS
    ws_ping_interval: int = HYPERLIQUID_WS_PING_INTERVAL_SECONDS
    stop_after_attempt: int = DEFAULT_STOP_AFTER_ATTEMPT

    @model_validator(mode="after")
    def set_default_urls(self) -> Self:
        if self.push_urls is None:
            self.push_urls = (
                [TESTNET_API_URL] if self.use_testnet else [MAINNET_API_URL]
            )
        return self


class SedaFeedConfig(BaseModel):
    """Configuration for a single SEDA oracle feed."""

    exec_program_id: str
    exec_inputs: str  # JSON string of inputs to the SEDA program


class SedaConfig(BaseModel):
    """
    SEDA oracle HTTP polling configuration.

    SEDA provides custom oracle feeds via HTTP polling (not WebSocket).
    Used for specialized feeds not available through Pyth.

    SEDA feeds can include multiple price fields:
    - price_field: Primary oracle price
    - last_price_field: Previous session's closing price
    - session_mark_px_ema_field: EMA price for mark calculations
    - session_flag_field: Boolean indicating off-hours (true = market closed)
    """

    url: str
    api_key_path: FilePath | None = None
    poll_interval: float
    poll_failure_interval: float  # Shorter interval on failure for faster recovery
    poll_timeout: float
    feeds: dict[str, SedaFeedConfig] | None = {}
    # Field names in SEDA response JSON (override if your program uses different names)
    price_field: str = "price"
    timestamp_field: str = "timestamp"
    last_price_field: str | None = None
    session_flag_field: str | None = None
    session_mark_px_ema_field: str | None = None


# =============================================================================
# PRICE SOURCE CONFIGURATION
# =============================================================================
# These models define how prices are sourced and computed for the waterfall.
# Each symbol can have multiple sources in priority order - the first valid
# (non-stale) price wins.


class PriceSource(BaseModel):
    """
    A single price source reference.

    Used within source configs to specify where to get a price from.

    Attributes:
        source_name: Which data source to use. Valid names:
            - "hl_oracle": Hyperliquid oraclePx from activeAssetCtx
            - "hl_mark": Hyperliquid markPx from activeAssetCtx
            - "hl_mid": Hyperliquid mid price from allMids
            - "lazer": Pyth Lazer feed
            - "hermes": Pythnet/Hermes feed
            - "seda": SEDA primary price
            - "seda_last": SEDA last/previous price
            - "seda_ema": SEDA EMA price
        source_id: Identifier for the specific feed (format depends on source_name)
        exponent: For Lazer/Hermes feeds, the price exponent (typically -8).
            Raw price is scaled by 10^(-exponent) to get actual price.
        use_session_flag: If true, only use this source when session_flag is true
            (i.e., during off-market hours). Used for session-aware pricing.
    """

    source_name: str
    source_id: str | int
    exponent: int | None = None
    use_session_flag: bool | None = False


class SingleSourceConfig(BaseModel):
    """
    Use a single price source directly without transformation.

    Example: { source_type = "single", source = { source_name = "hl_oracle", source_id = "BTC" } }

    Use when you want the raw price from a source (e.g., echoing HL's oracle price).
    """

    source_type: Literal["single"]
    source: PriceSource


class PairSourceConfig(BaseModel):
    """
    Compute price as base_price / quote_price.

    Example: BTC/USDT pair where base=BTC and quote=USDT gives BTC price in USD terms.

    { source_type = "pair",
      base_source = { source_name = "lazer", source_id = 1, exponent = -8 },
      quote_source = { source_name = "lazer", source_id = 8, exponent = -8 } }

    Both sources must be valid (non-stale) for the pair to be valid.
    """

    source_type: Literal["pair"]
    base_source: PriceSource
    quote_source: PriceSource


class SessionEMASourceConfig(BaseModel):
    """
    Session-aware mark price for assets with trading sessions (e.g., equity indices).

    Returns a list of 2 prices for Hyperliquid's mark price slots:
    - During market hours (session_flag=false): [oracle_price, ema_price]
    - Off hours (session_flag=true): [oracle_price, oracle_price]

    This allows different mark price behavior during vs outside trading sessions.
    The session_flag typically comes from a SEDA feed's session_flag_field.
    """

    source_type: Literal["session_ema"]
    oracle_source: PriceSource
    ema_source: PriceSource


class ConstantSourceConfig(BaseModel):
    """
    Return a fixed/hardcoded price value.

    Example: { source_type = "constant", value = "0.0100" }

    WARNING: Use sparingly! Constant prices don't update with market conditions.
    Only use for testing or assets with known fixed values.
    """

    source_type: Literal["constant"]
    value: str


class OracleMidAverageConfig(BaseModel):
    """
    Compute mark price as average of oracle price and market mid price.

    Formula: (oracle_price + mid_price) / 2

    Example: { source_type = "oracle_mid_average", symbol = "pyth:BTC" }

    This creates a mark price that's responsive to trading activity while
    still anchored to the oracle price. The symbol must match a key in the
    oracle config (e.g., "pyth:BTC" for market_name="pyth", symbol="BTC").

    Requires both:
    - A valid oracle price (computed earlier in the same publish cycle)
    - A fresh mid price from Hyperliquid's allMids subscription
    """

    source_type: Literal["oracle_mid_average"]
    symbol: str


# Union of all source config types for type checking
PriceSourceConfig = (
    SingleSourceConfig
    | PairSourceConfig
    | ConstantSourceConfig
    | OracleMidAverageConfig
    | SessionEMASourceConfig
)


class PriceConfig(BaseModel):
    """
    Price configuration for all symbols across all price types.

    Each price type is a dict mapping symbol -> list of source configs.
    The list order defines the WATERFALL priority: first valid price wins.

    Attributes:
        oracle: Primary oracle prices (required, used for liquidations/PnL)
        mark: Mark prices for funding calculations (optional, up to 2 values)
        external: External reference prices for monitoring (optional)
    """

    oracle: dict[str, list[PriceSourceConfig]] = {}
    mark: dict[str, list[PriceSourceConfig]] = {}
    external: dict[str, list[PriceSourceConfig]] = {}


class Config(BaseModel):
    """Root configuration model parsed from TOML file."""

    stale_price_threshold_seconds: (
        int  # Prices older than this are rejected from waterfall
    )
    prometheus_port: int
    hyperliquid: HyperliquidConfig
    kms: KMSConfig
    lazer: LazerConfig
    hermes: HermesConfig
    seda: SedaConfig
    multisig: MultisigConfig
    price: PriceConfig
