import http = require("http");
import client = require("prom-client");
import { DurationInMs, DurationInSec } from "./helpers";
import { logger } from "./logging";

// NOTE:  To create a new metric:
// 1) Create a private counter/gauge with appropriate name and help in metrics section of PromHelper
// 2) Create a method to set the metric to a value (such as `incIncoming` function below)
// 3) Register the metric using `register.registerMetric` function.

const SERVICE_PREFIX = "pyth__price_service__";

type WebSocketInteractionType =
  | "connection"
  | "close"
  | "timeout"
  | "server_update"
  | "client_message";

export class PromClient {
  private register = new client.Registry();

  // Actual metrics
  private receivedVaaCounter = new client.Counter({
    name: `${SERVICE_PREFIX}vaas_received`,
    help: "number of Pyth VAAs received",
  });
  private priceUpdatesPublishTimeGapHistogram = new client.Histogram({
    name: `${SERVICE_PREFIX}price_updates_publish_time_gap_seconds`,
    help: "Summary of publish time gaps between price updates",
    buckets: [1, 3, 5, 10, 15, 30, 60, 120],
  });
  private priceUpdatesAttestationTimeGapHistogram = new client.Histogram({
    name: `${SERVICE_PREFIX}price_updates_attestation_time_gap_seconds`,
    help: "Summary of attestation time gaps between price updates",
    buckets: [1, 3, 5, 10, 15, 30, 60, 120],
  });
  private webSocketInteractionCounter = new client.Counter({
    name: `${SERVICE_PREFIX}websocket_interaction`,
    help: "number of Web Socket interactions",
    labelNames: ["type", "status"],
  });
  // End metrics

  private server = http.createServer(async (req, res) => {
    if (req.url === "/metrics") {
      // Return all metrics in the Prometheus exposition format
      res.setHeader("Content-Type", this.register.contentType);
      res.write(await this.register.metrics());
      res.end();
    }
  });

  constructor(config: { name: string; port: number }) {
    this.register.setDefaultLabels({
      app: config.name,
    });
    // Register each metric
    this.register.registerMetric(this.receivedVaaCounter);
    this.register.registerMetric(this.priceUpdatesPublishTimeGapHistogram);
    this.register.registerMetric(this.priceUpdatesAttestationTimeGapHistogram);
    this.register.registerMetric(this.webSocketInteractionCounter);
    // End registering metric

    logger.info("prometheus client listening on port " + config.port);
    this.server.listen(config.port);
  }

  incReceivedVaa() {
    this.receivedVaaCounter.inc();
  }

  addPriceUpdatesPublishTimeGap(gap: DurationInSec) {
    this.priceUpdatesPublishTimeGapHistogram.observe(gap);
  }

  addPriceUpdatesAttestationTimeGap(gap: DurationInSec) {
    this.priceUpdatesAttestationTimeGapHistogram.observe(gap);
  }

  addWebSocketInteraction(
    type: WebSocketInteractionType,
    status: "ok" | "err"
  ) {
    this.webSocketInteractionCounter.inc({
      type,
      status,
    });
  }
}
