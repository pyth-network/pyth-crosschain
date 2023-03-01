// #!/usr/bin/env node
// // FIXME: update readme and compose files
// // FIXME: release a new version
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import injective from "./injective/command";
import evm from "./evm/command";

yargs(hideBin(process.argv))
  .config("config")
  .global("config")
  .command(evm)
  .command(injective)
  .help().argv;
