from hyperliquid.utils.constants import MAINNET_API_URL, TESTNET_API_URL
from pydantic import BaseModel, model_validator
from typing import Optional

STALE_TIMEOUT_SECONDS = 5


class KMSConfig(BaseModel):
    enable_kms: bool
    aws_kms_key_id_path: str


class LazerConfig(BaseModel):
    lazer_urls: list[str]
    lazer_api_key: str
    base_feed_id: int
    base_feed_exponent: int
    quote_feed_id: int
    quote_feed_exponent: int


class HermesConfig(BaseModel):
    hermes_urls: list[str]
    base_feed_id: str
    base_feed_exponent: int
    quote_feed_id: str
    quote_feed_exponent: int


class HyperliquidConfig(BaseModel):
    hyperliquid_ws_urls: list[str]
    push_urls: Optional[list[str]] = None
    market_name: str
    market_symbol: str
    use_testnet: bool
    oracle_pusher_key_path: str
    publish_interval: float
    enable_publish: bool

    @model_validator(mode="after")
    def set_default_urls(self):
        if self.push_urls is None:
            self.push_urls = [TESTNET_API_URL] if self.use_testnet else [MAINNET_API_URL]
        return self


class Config(BaseModel):
    stale_price_threshold_seconds: int
    prometheus_port: int
    hyperliquid: HyperliquidConfig
    kms: KMSConfig
    lazer: LazerConfig
    hermes: HermesConfig
