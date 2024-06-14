#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import solana from "./solana/command";

yargs(hideBin(process.argv))
  .parserConfiguration({
    "parse-numbers": false,
  })
  .config("config")
  .global("config")
  .command(solana)
  .help().argv;
