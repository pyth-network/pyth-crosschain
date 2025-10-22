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
        self.no_oracle_price_counter = self.meter.create_counter(
            name="hip_3_pusher_no_oracle_price_count",
            description="Number of failed push attempts with no valid oracle price",
        )
        self.successful_push_counter = self.meter.create_counter(
            name="hip_3_pusher_successful_push_count",
            description="Number of successful push attempts",
        )
        self.failed_push_counter = self.meter.create_counter(
            name="hip_3_pusher_failed_push_count",
            description="Number of failed push attempts",
        )
        self.push_interval_histogram = self.meter.create_histogram(
            name="hip_3_pusher_push_interval",
            description="Interval between push requests (seconds)",
            unit="s",
        )
