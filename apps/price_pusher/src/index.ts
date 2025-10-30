import createCLI from "yargs";
import { hideBin } from "yargs/helpers";

import aptos from "./aptos/command.js";
import evm from "./evm/command.js";
import fuel from "./fuel/command.js";
import injective from "./injective/command.js";
import near from "./near/command.js";
import { enableMetrics, metricsPort } from "./options.js";
import solana from "./solana/command.js";
import sui from "./sui/command.js";
import ton from "./ton/command.js";

const yargs = createCLI(hideBin(process.argv));

// let the application run but don't await on the value here, per existing behavior
void yargs
  .parserConfiguration({
    "parse-numbers": false,
  })
  .config("config")
  .global("config")
  .option("enable-metrics", enableMetrics["enable-metrics"])
  .option("metrics-port", metricsPort["metrics-port"])
  .command(evm)
  .command(fuel)
  .command(injective)
  .command(aptos)
  .command(sui)
  .command(near)
  .command(solana)
  .command(ton)
  .help().argv;
