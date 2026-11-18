import { inspect } from "node:util";

import createCLI from "yargs";
import { hideBin } from "yargs/helpers";

import aptos from "./aptos/command.js";
import evm from "./evm/command.js";
import fuel from "./fuel/command.js";
import injective from "./injective/command.js";
import { redactSecrets } from "./logger.js";
import near from "./near/command.js";
import { enableMetrics, metricsPort } from "./options.js";
import solana from "./solana/command.js";
import sui from "./sui/command.js";
import ton from "./ton/command.js";

// Print an error that escapes the logger, with known secrets removed, and
// exit. Library errors (such as viem's) embed the RPC URL.
function exitWithRedactedError(err: unknown): never {
  // biome-ignore lint/suspicious/noConsole: the logger may not exist yet
  console.error(redactSecrets(inspect(err)));
  process.exit(1);
}

// Commands start their controller with `void controller.start()`, so a failed
// first RPC call surfaces here instead of in the yargs `.fail` handler.
process.on("unhandledRejection", exitWithRedactedError);
process.on("uncaughtException", exitWithRedactedError);

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
  .fail((msg, err, cli) => {
    if (err) {
      // An error thrown by a command handler, e.g. an RPC request failing at
      // startup.
      exitWithRedactedError(err);
    }
    cli.showHelp();
    // biome-ignore lint/suspicious/noConsole: usage errors go to stderr
    console.error(`\n${msg}`);
    process.exit(1);
  })
  .help().argv;
