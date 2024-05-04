#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import injective from "./injective/command";
import evm from "./evm/command";
import aptos from "./aptos/command";
import sui from "./sui/command";
import near from "./near/command";
import solana from "./solana/command";

yargs(hideBin(process.argv))
  .parserConfiguration({
    "parse-numbers": false,
  })
  .config("config")
  .global("config")
  .command(evm)
  .command(injective)
  .command(aptos)
  .command(sui)
  .command(near)
  .command(solana)
  .help().argv;
