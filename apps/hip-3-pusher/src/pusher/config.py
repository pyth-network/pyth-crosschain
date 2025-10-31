from hyperliquid.utils.constants import MAINNET_API_URL, TESTNET_API_URL
from pydantic import BaseModel, FilePath, model_validator
from typing import Optional
from typing import Literal, Union

STALE_TIMEOUT_SECONDS = 5


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


class HermesConfig(BaseModel):
    hermes_urls: list[str]
    feed_ids: list[str]


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

    @model_validator(mode="after")
    def set_default_urls(self):
        if self.push_urls is None:
            self.push_urls = [TESTNET_API_URL] if self.use_testnet else [MAINNET_API_URL]
        return self


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


PriceSourceConfig = Union[SingleSourceConfig, PairSourceConfig, ConstantSourceConfig]


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
    multisig: MultisigConfig
    price: PriceConfig
