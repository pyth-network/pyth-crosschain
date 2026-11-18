import { writeSync } from "node:fs";
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

// Write to stderr synchronously. When stderr is a pipe (as in the container),
// `console.error` writes asynchronously, and the `process.exit` that follows
// can drop the message.
function writeStderrSync(text: string): void {
  writeSync(2, `${text}\n`);
}

// Print an error that escapes the logger, with known secrets removed, and
// exit. Library errors (such as viem's) embed the RPC URL.
function exitWithRedactedError(err: unknown): never {
  writeStderrSync(redactSecrets(inspect(err)));
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
    cli.showHelp((help) => writeStderrSync(help));
    writeStderrSync(`\n${msg}`);
    process.exit(1);
  })
  .help().argv;
