from hyperliquid.utils.constants import MAINNET_API_URL, TESTNET_API_URL
from pydantic import BaseModel, FilePath, model_validator
from typing import Optional
from typing import Literal

# Interval of time after which we'll cycle websocket connections
STALE_TIMEOUT_SECONDS = 5
# This is the interval to call userRateLimit. Low-frequency as it's just for long-term metrics.
USER_LIMIT_INTERVAL_SECONDS = 1800
# HL has an application-level ping-pong that should be handled on the order of a minute.
HYPERLIQUID_WS_PING_INTERVAL_SECONDS = 20
# Number of websocket failures before we crash/restart the app.
DEFAULT_STOP_AFTER_ATTEMPT = 20


class KMSConfig(BaseModel):
    enable_kms: bool
    aws_kms_key_id_path: Optional[FilePath] = None


class MultisigConfig(BaseModel):
    enable_multisig: bool
    multisig_address: Optional[str] = None


class LazerConfig(BaseModel):
    lazer_urls: list[str]
    lazer_api_key: str
    feed_ids: list[int]
    stop_after_attempt: int = DEFAULT_STOP_AFTER_ATTEMPT


class HermesConfig(BaseModel):
    hermes_urls: list[str]
    feed_ids: list[str]
    stop_after_attempt: int = DEFAULT_STOP_AFTER_ATTEMPT


class HyperliquidConfig(BaseModel):
    hyperliquid_ws_urls: list[str]
    push_urls: Optional[list[str]] = None
    market_name: str
    asset_context_symbols: list[str]
    use_testnet: bool
    oracle_pusher_key_path: Optional[FilePath] = None
    publish_interval: float
    publish_timeout: float
    enable_publish: bool
    user_limit_interval: int = USER_LIMIT_INTERVAL_SECONDS
    ws_ping_interval: int = HYPERLIQUID_WS_PING_INTERVAL_SECONDS
    stop_after_attempt: int = DEFAULT_STOP_AFTER_ATTEMPT

    @model_validator(mode="after")
    def set_default_urls(self):
        if self.push_urls is None:
            self.push_urls = [TESTNET_API_URL] if self.use_testnet else [MAINNET_API_URL]
        return self


class SedaFeedConfig(BaseModel):
    exec_program_id: str
    exec_inputs: str


class SedaConfig(BaseModel):
    url: str
    api_key_path: Optional[FilePath] = None
    poll_interval: float
    poll_failure_interval: float
    poll_timeout: float
    feeds: Optional[dict[str, SedaFeedConfig]] = {}


class PriceSource(BaseModel):
    source_name: str
    source_id: str | int
    exponent: Optional[int] = None


class SingleSourceConfig(BaseModel):
    source_type: Literal["single"]
    source: PriceSource


class PairSourceConfig(BaseModel):
    source_type: Literal["pair"]
    base_source: PriceSource
    quote_source: PriceSource


class ConstantSourceConfig(BaseModel):
    source_type: Literal["constant"]
    value: str


class OracleMidAverageConfig(BaseModel):
    source_type: Literal["oracle_mid_average"]
    symbol: str


PriceSourceConfig = SingleSourceConfig | PairSourceConfig | ConstantSourceConfig | OracleMidAverageConfig


class PriceConfig(BaseModel):
    oracle: dict[str, list[PriceSourceConfig]] = {}
    mark: dict[str, list[PriceSourceConfig]] = {}
    external: dict[str, list[PriceSourceConfig]] = {}


class Config(BaseModel):
    stale_price_threshold_seconds: int
    prometheus_port: int
    hyperliquid: HyperliquidConfig
    kms: KMSConfig
    lazer: LazerConfig
    hermes: HermesConfig
    seda: SedaConfig
    multisig: MultisigConfig
    price: PriceConfig
