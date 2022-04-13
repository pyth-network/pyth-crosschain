import http = require("http");
import client = require("prom-client");
import { DurationInSec } from "./helpers";
import { logger } from "./logging";

// NOTE:  To create a new metric:
// 1) Create a private counter/gauge with appropriate name and help in metrics section of PromHelper
// 2) Create a method to set the metric to a value (such as `incIncoming` function below)
// 3) Register the metric using `register.registerMetric` function.

const SERVICE_PREFIX = "price_service_";

export class PromClient {
  private register = new client.Registry();
  private collectDefaultMetrics = client.collectDefaultMetrics;

  // Actual metrics
  private receivedVaaCounter = new client.Counter({
    name: SERVICE_PREFIX + "VAAs_received",
    help: "number of Pyth VAAs received",
  });
  private apiLatestVaaRequestsCounter = new client.Counter({
    name: SERVICE_PREFIX + "api_latest_vaa_requests_received",
    help: "Number of requests for latest vaa of a price feed"
  });
  private apiLatestVaaNotFoundResponseCounter = new client.Counter({
    name: SERVICE_PREFIX + "api_latest_vaa_not_found_response",
    help: "Number of not found responses for latest vaa of a price feed request"
  });
  private apiLatestVaaSuccessResponseCounter = new client.Counter({
    name: SERVICE_PREFIX + "api_latest_vaa_not_found",
    help: "Number of successful responses for latest vaa of a price feed request"
  });
  private apiLatestVaaFreshnessHistogram = new client.Histogram({
    name: SERVICE_PREFIX + "api_latest_vaa_freshness",
    help: "Freshness time of Vaa (time difference of Vaa and request time)",
    buckets: [1, 5, 10, 15, 30, 60, 120, 180]
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
    this.register.registerMetric(this.apiLatestVaaRequestsCounter);
    this.register.registerMetric(this.apiLatestVaaNotFoundResponseCounter);
    this.register.registerMetric(this.apiLatestVaaSuccessResponseCounter);
    this.register.registerMetric(this.apiLatestVaaFreshnessHistogram);
    // End registering metric

    logger.info("prometheus client listening on port " + config.port);
    this.server.listen(config.port);
  }

  incReceivedVaa() {
    this.receivedVaaCounter.inc();
  }

  incApiLatestVaaRequests() {
    this.apiLatestVaaRequestsCounter.inc();
  }

  incApiLatestVaaNotFoundResponse() {
    this.apiLatestVaaNotFoundResponseCounter.inc();
  }

  incApiLatestVaaSuccessResponse() {
    this.apiLatestVaaSuccessResponseCounter.inc();
  }

  addApiLatestVaaFreshness(duration: DurationInSec) {
    this.apiLatestVaaFreshnessHistogram.observe(duration);
  }
}
