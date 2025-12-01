from prometheus_client import start_http_server
from opentelemetry.exporter.prometheus import PrometheusMetricReader
from opentelemetry.metrics import get_meter_provider, set_meter_provider
from opentelemetry.sdk.metrics import MeterProvider

from pusher.config import Config

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
