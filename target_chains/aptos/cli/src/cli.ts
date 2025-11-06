#!/usr/bin/env node

import createCLI from "yargs";
import { hideBin } from "yargs/helpers";
import { builder } from "./commands/aptos.js";

const yargs = createCLI(hideBin(process.argv));

builder(yargs).argv;
