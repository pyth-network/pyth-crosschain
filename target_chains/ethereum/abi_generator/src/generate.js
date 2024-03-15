#!/usr/bin/env node

const { generateAbi } = require("./index");
const contracts = process.argv.slice(2);
generateAbi(contracts);
