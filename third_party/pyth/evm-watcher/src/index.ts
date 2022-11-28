import { Handler } from "./handler";
import { Listener } from "./listener";
import { envOrErr } from "./utils";
import { JsonLogger } from "./watchers/json-logger";

console.log("Loading config file .env");
require("dotenv").config();

const handler = new Handler();
const listener = new Listener(
  {
    wsEndpoint: envOrErr("WS_ENDPOINT"),
    pythContract: envOrErr("PYTH_CONTRACT"),
  },
  handler
);

// Initialize Watchers
const jsonLogger = new JsonLogger();
handler.subscribe(jsonLogger);

listener.start();
