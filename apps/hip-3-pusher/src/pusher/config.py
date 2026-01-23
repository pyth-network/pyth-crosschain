from hyperliquid.utils.constants import MAINNET_API_URL, TESTNET_API_URL
from pydantic import BaseModel, FilePath, model_validator
from typing import Literal, Self

# Interval of time after which we'll cycle websocket connections
STALE_TIMEOUT_SECONDS: int = 5
# This is the interval to call userRateLimit. Low-frequency as it's just for long-term metrics.
USER_LIMIT_INTERVAL_SECONDS: int = 1800
# HL has an application-level ping-pong that should be handled on the order of a minute.
HYPERLIQUID_WS_PING_INTERVAL_SECONDS: int = 20
# Number of websocket failures before we crash/restart the app.
DEFAULT_STOP_AFTER_ATTEMPT: int = 20


class KMSConfig(BaseModel):
    enable_kms: bool
    aws_kms_key_id_path: FilePath | None = None


class MultisigConfig(BaseModel):
    enable_multisig: bool
    multisig_address: str | None = None


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
    push_urls: list[str] | None = None
    market_name: str
    asset_context_symbols: list[str]
    use_testnet: bool
    oracle_pusher_key_path: FilePath | None = None
    publish_interval: float
    publish_timeout: float
    enable_publish: bool
    duplicate_mark_price: bool = False
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
    exec_program_id: str
    exec_inputs: str


class SedaConfig(BaseModel):
    url: str
    api_key_path: FilePath | None = None
    poll_interval: float
    poll_failure_interval: float
    poll_timeout: float
    feeds: dict[str, SedaFeedConfig] | None = {}
    price_field: str = "price"
    timestamp_field: str = "timestamp"
    last_price_field: str | None = None
    session_flag_field: str | None = None
    session_mark_px_ema_field: str | None = None


class PriceSource(BaseModel):
    source_name: str
    source_id: str | int
    exponent: int | None = None
    use_session_flag: bool | None = False


class SingleSourceConfig(BaseModel):
    source_type: Literal["single"]
    source: PriceSource


class PairSourceConfig(BaseModel):
    source_type: Literal["pair"]
    base_source: PriceSource
    quote_source: PriceSource


class SessionEMASourceConfig(BaseModel):
    source_type: Literal["session_ema"]
    oracle_source: PriceSource
    ema_source: PriceSource


class ConstantSourceConfig(BaseModel):
    source_type: Literal["constant"]
    value: str


class OracleMidAverageConfig(BaseModel):
    source_type: Literal["oracle_mid_average"]
    symbol: str


PriceSourceConfig = (
    SingleSourceConfig
    | PairSourceConfig
    | ConstantSourceConfig
    | OracleMidAverageConfig
    | SessionEMASourceConfig
)


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
