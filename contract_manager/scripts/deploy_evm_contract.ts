import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/core/chains";
import { DefaultStore } from "../src/node/utils/store";
import { readFileSync } from "fs";
import { toPrivateKey } from "../src/core/base";

import { COMMON_DEPLOY_OPTIONS } from "./common";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_contract.ts")
  .usage(
    "Usage: $0 --std-output <path/to/std-output.json> --private-key <private-key> --chain <chain> [--deploy-args <arg> [... <args>]]",
  )
  .options({
    "std-output": {
      type: "string",
      demandOption: true,
      desc: "Path to the standard JSON output of the contract (build artifact)",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain to upload the contract on. Must be one of the chains available in the store",
    },
    "deploy-args": {
      type: "array",
      desc: "Arguments to pass to the contract constructor. They should not be prefixed with 0x.",
    },
  });

async function main() {
  const argv = await parser.argv;

  const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
  const artifact = JSON.parse(readFileSync(argv["std-output"], "utf8"));
  const address = await chain.deploy(
    toPrivateKey(argv["private-key"]),
    artifact["abi"],
    artifact["bytecode"],
    argv["deploy-args"] || [],
  );

  console.log(`Deployed contract at ${address}`);
}

main();
