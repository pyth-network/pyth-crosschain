import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import { envOrErr } from "./helpers";
import { Listener } from "./listen";
import { initLogger } from "./logging";
import { PromClient } from "./promClient";
import { RestAPI } from "./rest";


let configFile: string = ".env";
if (process.env.PYTH_RELAY_CONFIG) {
  configFile = process.env.PYTH_RELAY_CONFIG;
}

console.log("Loading config file [%s]", configFile);
require("dotenv").config({ path: configFile });

setDefaultWasm("node");

// Set up the logger.
initLogger({logLevel: process.env.LOG_LEVEL});

const promClient = new PromClient({
  name: "pyth_relay",
  port: parseInt(envOrErr("PROM_PORT"))
});

const listener = new Listener({
  spyServiceHost: envOrErr("SPY_SERVICE_HOST"),
  filtersRaw: process.env.SPY_SERVICE_FILTERS,
  readiness: {
    spySyncTimeSeconds: parseInt(envOrErr("READINESS_SPY_SYNC_TIME_SECONDS")),
    numLoadedSymbols: parseInt(envOrErr("READINESS_NUM_LOADED_SYMBOLS"))
  }
}, promClient);

// In future if we have more components we will modify it to include them all
const isReady = () => listener.isReady();

const restAPI = new RestAPI({
  port: parseInt(envOrErr("REST_PORT"))
}, listener, isReady);

listener.run();
restAPI.run();
