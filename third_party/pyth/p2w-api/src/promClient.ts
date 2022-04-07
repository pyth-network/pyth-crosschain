import http = require("http");
import client = require("prom-client");
import { logger } from "./logging";

// NOTE:  To create a new metric:
// 1) Create a private counter/gauge with appropriate name and help in metrics section of PromHelper
// 2) Create a method to set the metric to a value (such as `incIncoming` function below)
// 3) Register the metric using `register.registerMetric` function.

export class PromClient {
  private register = new client.Registry();
  private walletReg = new client.Registry();
  private collectDefaultMetrics = client.collectDefaultMetrics;

  // Actual metrics
  private listenCounter = new client.Counter({
    name: "VAAs_received",
    help: "number of Pyth VAAs received",
  });
  // End metrics

  private server = http.createServer(async (req, res) => {
    if (req.url === "/metrics") {
      // Return all metrics in the Prometheus exposition format
      res.setHeader("Content-Type", this.register.contentType);
      res.write(await this.register.metrics());
      res.end(await this.walletReg.metrics());
    }
  });

  constructor(config: {name: string, port: number; }) {
    this.register.setDefaultLabels({
      app: config.name,
    });
    this.collectDefaultMetrics({ register: this.register });
    // Register each metric
    this.register.registerMetric(this.listenCounter);
    // End registering metric

    logger.info("prometheus client listening on port " + config.port);
    this.server.listen(config.port);
  }

  incIncoming() {
    this.listenCounter.inc();
  }
}
