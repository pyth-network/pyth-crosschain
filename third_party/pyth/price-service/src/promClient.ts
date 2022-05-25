import { stat } from "fs";
import http = require("http");
import client = require("prom-client");
import { DurationInMs, DurationInSec } from "./helpers";
import { logger } from "./logging";

// NOTE:  To create a new metric:
// 1) Create a private counter/gauge with appropriate name and help in metrics section of PromHelper
// 2) Create a method to set the metric to a value (such as `incIncoming` function below)
// 3) Register the metric using `register.registerMetric` function.

const SERVICE_PREFIX = "pyth__price_service__";

export class PromClient {
  private register = new client.Registry();
  private collectDefaultMetrics = client.collectDefaultMetrics;

  // Actual metrics
  private receivedVaaCounter = new client.Counter({
    name: `${SERVICE_PREFIX}vaas_received`,
    help: "number of Pyth VAAs received",
  });
  private apiResponseTimeSummary = new client.Summary({
    name: `${SERVICE_PREFIX}api_response_time_ms`,
    help: "Response time of a VAA",
    labelNames: ["path", "status"]
  });
  private apiRequestsPriceFreshnessHistogram = new client.Histogram({
    name: `${SERVICE_PREFIX}api_requests_price_freshness_seconds`,
    help: "Freshness time of Vaa (time difference of Vaa and request time)",
    buckets: [1, 5, 10, 15, 30, 60, 120, 180],
    labelNames: ["path", "price_id"]
  });
  private webSocketInteractionCounter = new client.Counter({
    name: `${SERVICE_PREFIX}websocket_interaction`,
    help: "number of Web Socket interactions",
    labelNames: ["type", "status"]
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

  constructor(config: {name: string, port: number; }) {
    this.register.setDefaultLabels({
      app: config.name,
    });
    this.collectDefaultMetrics({ register: this.register, prefix: SERVICE_PREFIX });
    // Register each metric
    this.register.registerMetric(this.receivedVaaCounter);
    this.register.registerMetric(this.apiResponseTimeSummary)
    this.register.registerMetric(this.apiRequestsPriceFreshnessHistogram);
    this.register.registerMetric(this.webSocketInteractionCounter);
    // End registering metric

    logger.info("prometheus client listening on port " + config.port);
    this.server.listen(config.port);
  }

  incReceivedVaa() {
    this.receivedVaaCounter.inc();
  }

  addResponseTime(path: string, status: number, duration: DurationInMs) {
    this.apiResponseTimeSummary.observe({
      path: path,
      status: status
    }, duration);
  }

  addApiRequestsPriceFreshness(path: string, priceId: string, duration: DurationInSec) {
    this.apiRequestsPriceFreshnessHistogram.observe({
      path: path,
      price_id: priceId,
    }, duration);
  }

  addWebSocketInteraction(type: string, status: "ok" | "err") {
    this.webSocketInteractionCounter.inc({
      type: type,
      status: status
    });
  }
}
