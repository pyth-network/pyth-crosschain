import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import * as fs from "fs";
import * as listen from "./listen";
import * as worker from "./worker";
import * as rest from "./rest";
import * as helpers from "./helpers";
import { logger } from "./helpers";
import { PromHelper } from "./promHelpers";

import { Relay } from "./relay/iface";
import { TerraRelay } from "./relay/terra";
import { EvmRelay } from "./relay/evm";

let configFile: string = ".env";
if (process.env.PYTH_RELAY_CONFIG) {
  configFile = process.env.PYTH_RELAY_CONFIG;
}

console.log("Loading config file [%s]", configFile);
require("dotenv").config({ path: configFile });

setDefaultWasm("node");

// Set up the logger.
helpers.initLogger();

let error: boolean = false;
let listenOnly: boolean = false;
let relayImpl: Relay | null = null;
for (let idx = 0; idx < process.argv.length; ++idx) {
  if (process.argv[idx] === "--listen_only") {
    logger.info("running in listen only mode, will not relay anything!");
    listenOnly = true;
  } else if (process.argv[idx] === "--terra" && !relayImpl) {
    relayImpl = new TerraRelay({
      nodeUrl: helpers.envOrErr("TERRA_NODE_URL"),
      terraChainId: helpers.envOrErr("TERRA_CHAIN_ID"),
      walletPrivateKey: helpers.envOrErr("TERRA_PRIVATE_KEY"),
      coin: helpers.envOrErr("TERRA_COIN"),
      contractAddress: helpers.envOrErr("TERRA_PYTH_CONTRACT_ADDRESS"),
    });
    logger.info("Relaying to Terra");
  } else if (process.argv[idx] === "--evm" && !relayImpl) {

    relayImpl = new EvmRelay({
      rpcWsUrl: helpers.envOrErr("EVM_NODE_WEBSOCKET_URL"),
      payerWalletMnemonic: fs
        .readFileSync(helpers.envOrErr("EVM_WALLET_MNEMONIC_FILE"))
        .toString("utf-8")
        .trim(),
      payerHDWalletPath: helpers.envOrErr(
        "EVM_HDWALLET_PATH",
        "m/44'/60'/0'/0"
      ), // ETH mainnet default
      p2wContractAddress: helpers.envOrErr("EVM_PYTH_CONTRACT_ADDRESS"),
    });
    logger.info("Relaying to EVM.");
  }
}

if (!relayImpl) {
  logger.error("No relay implementation specified");
  error = true;
}

if (
  !error &&
  listen.init(listenOnly) &&
  worker.init(!listenOnly, relayImpl as any) &&
  rest.init(!listenOnly)
) {
  // Start the Prometheus client with the app name and http port
  let promPort = 8081;
  if (process.env.PROM_PORT) {
    promPort = parseInt(process.env.PROM_PORT);
  }
  logger.info("prometheus client listening on port " + promPort);
  const promClient = new PromHelper("pyth_relay", promPort);

  listen.run(promClient);
  if (!listenOnly) {
    worker.run(promClient);
    rest.run();
  }
}
