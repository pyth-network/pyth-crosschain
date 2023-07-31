#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { builder } from "./commands/aptos";

builder(yargs(hideBin(process.argv))).argv;
