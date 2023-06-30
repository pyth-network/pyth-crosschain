import { envOrErr, parseToOptionalNumber } from "./helpers";
import { Listener } from "./listen";
import { initLogger } from "./logging";
import { PromClient } from "./promClient";
import { RestAPI } from "./rest";
import { WebSocketAPI } from "./ws";

let configFile: string = ".env";
if (process.env.PYTH_PRICE_SERVICE_CONFIG) {
  configFile = process.env.PYTH_PRICE_SERVICE_CONFIG;
}

// tslint:disable:no-console
console.log("Loading config file [%s]", configFile);
// tslint:disable:no-var-requires
require("dotenv").config({ path: configFile });

// Set up the logger.
initLogger({ logLevel: process.env.LOG_LEVEL });

async function run() {
  const promClient = new PromClient({
    name: "price_service",
    port: parseInt(envOrErr("PROM_PORT"), 10),
  });

  const listener = new Listener(
    {
      spyServiceHost: envOrErr("SPY_SERVICE_HOST"),
      filtersRaw: process.env.SPY_SERVICE_FILTERS,
      wormholeCluster: process.env.WORMHOLE_CLUSTER,
      readiness: {
        spySyncTimeSeconds: parseInt(
          envOrErr("READINESS_SPY_SYNC_TIME_SECONDS"),
          10
        ),
        numLoadedSymbols: parseInt(
          envOrErr("READINESS_NUM_LOADED_SYMBOLS"),
          10
        ),
      },
      cacheCleanupLoopInterval: parseToOptionalNumber(
        process.env.REMOVE_EXPIRED_VALUES_INTERVAL_SECONDS
      ),
      cacheTtl: parseToOptionalNumber(process.env.CACHE_TTL_SECONDS),
    },
    promClient
  );

  // In future if we have more components we will modify it to include them all
  const isReady = () => listener.isReady();

  const restAPI = new RestAPI(
    {
      port: parseInt(envOrErr("REST_PORT"), 10),
      dbApiEndpoint: process.env.DB_API_ENDPOINT,
      dbApiCluster: process.env.DB_API_CLUSTER,
    },
    listener,
    isReady,
    promClient
  );

  const wsAPI = new WebSocketAPI(listener, promClient);

  listener.run();

  const server = await restAPI.run();
  wsAPI.run(server);
}

run();
