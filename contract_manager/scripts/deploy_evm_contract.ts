import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/chains";
import { DefaultStore } from "../src/store";
import { readFileSync } from "fs";
import { toPrivateKey } from "../src";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_contract.ts")
  .usage(
    "Usage: $0 --code <path/to/std-output.json> --private-key <private-key> --chain <chain> [--deploy-args <arg> [... <args>]]"
  )
  .options({
    "std-output": {
      type: "string",
      demandOption: true,
      desc: "Path to the standard output of the contract (build artifact)",
    },
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to use for the deployment",
    },
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain to upload the contract on. Can be one of the evm chains available in the store",
    },
    "deploy-args": {
      type: "array",
      desc: "Arguments to pass to the contract constructor",
    },
  });

async function main() {
  const argv = await parser.argv;

  const chain = DefaultStore.chains[argv.chain] as EvmChain;
  const artifact = JSON.parse(readFileSync(argv["std-output"], "utf8"));
  const address = await chain.deploy(
    toPrivateKey(argv["private-key"]),
    artifact["abi"],
    artifact["bytecode"],
    argv["deploy-args"] || []
  );

  console.log(`Deployed contract at ${address}`);
}

main();
