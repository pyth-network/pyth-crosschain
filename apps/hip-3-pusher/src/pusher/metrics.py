from prometheus_client import start_http_server
from opentelemetry.exporter.prometheus import PrometheusMetricReader
from opentelemetry.metrics import get_meter_provider, set_meter_provider
from opentelemetry.sdk.metrics import MeterProvider

from pusher.config import Config, PriceConfig, PriceSourceConfig, ConstantSourceConfig, SingleSourceConfig, \
    PairSourceConfig, OracleMidAverageConfig, PriceSource

METER_NAME = "hip3pusher"


class Metrics:
    def __init__(self, config: Config):
        # Adapted from opentelemetry-exporter-prometheus example code.
        # Start Prometheus client
        start_http_server(port=config.prometheus_port)
        # Exporter to export metrics to Prometheus
        reader = PrometheusMetricReader()
        # Meter is responsible for creating and recording metrics
        set_meter_provider(MeterProvider(metric_readers=[reader]))
        self.meter = get_meter_provider().get_meter(METER_NAME)
        self._init_metrics()

    def _init_metrics(self):
        # labels: dex, symbol
        self.last_pushed_time = self.meter.create_gauge(
            name="hip_3_relayer_last_published_time",
            description="Time of last successful oracle update",
        )
        # labels: dex, symbol, status, error_reason
        self.update_attempts_total = self.meter.create_counter(
            name="hip_3_relayer_update_attempts_total",
            description="Number of update attempts",
        )
        # labels: dex
        self.no_oracle_price_counter = self.meter.create_counter(
            name="hip_3_relayer_no_oracle_price_count",
            description="Number of failed push attempts with no valid oracle price",
        )
        # labels: dex
        self.push_interval_histogram = self.meter.create_histogram(
            name="hip_3_relayer_push_interval",
            description="Interval between push requests (seconds)",
            unit="s",
        )
        # labels: dex, price_type, symbol
        self.price_config_counter = self.meter.create_counter(
            name="hip_3_relayer_price_config",
            description="Price source config",
        )

    def set_price_configs(self, dex: str, price_config: PriceConfig):
        self._set_price_config_type(dex, price_config.oracle, "oracle")
        self._set_price_config_type(dex, price_config.mark, "mark")
        self._set_price_config_type(dex, price_config.external, "external")

    def _set_price_config_type(self, dex: str, price_source_config: dict[str, list[PriceSourceConfig]], price_type: str):
        for symbol in price_source_config:
            source_config_str = ' | '.join(self._get_source_config_str(source_config) for source_config in price_source_config[symbol])
            labels = {
                "dex": dex,
                "symbol": symbol,
                "price_type": price_type,
                "config": source_config_str,
            }
            self.price_config_counter.add(1, labels)

    def _get_source_config_str(self, source_config: PriceSourceConfig):
        if isinstance(source_config, ConstantSourceConfig):
            return f"constant({source_config.value})"
        elif isinstance(source_config, SingleSourceConfig):
            return self._get_price_source_str(source_config.source)
        elif isinstance(source_config, PairSourceConfig):
            base_str = self._get_price_source_str(source_config.base_source)
            quote_str = self._get_price_source_str(source_config.quote_source)
            return f"pair({base_str},{quote_str})"
        elif isinstance(source_config, OracleMidAverageConfig):
            return f"oracle_mid_average({source_config.symbol})"
        else:
            return "unknown"

    def _get_price_source_str(self, price_source: PriceSource):
        return f"{price_source.source_name}({str(price_source.source_id)[:8]})"
