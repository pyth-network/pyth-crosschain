#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import injective from "./injective/command";
import evm from "./evm/command";
import aptos from "./aptos/command";
import sui from "./sui/command";
import near from "./near/command";
import solana from "./solana/command";
import fuel from "./fuel/command";
import ton from "./ton/command";
import { enableMetrics, metricsPort } from "./options";

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
