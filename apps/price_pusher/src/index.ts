#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import injective from "./injective/command.js";
import evm from "./evm/command.js";
import aptos from "./aptos/command.js";
import sui from "./sui/command.js";
import near from "./near/command.js";
import solana from "./solana/command.js";
import fuel from "./fuel/command.js";
import ton from "./ton/command.js";
import { enableMetrics, metricsPort } from "./options.js";

yargs(hideBin(process.argv))
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
