import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { CosmWasmChain } from "../src/chains";
import { CosmWasmContract } from "../src/contracts/cosmwasm";
import { DefaultStore } from "../src/store";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_cosmwasm.ts")
  .usage(
    "Usage: $0 --code <path/to/artifact.wasm> --private-key <private-key> --chain <chain>"
  )
  .options({
    code: {
      type: "string",
      demandOption: true,
      desc: "Path to the artifact .wasm file",
    },
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to use for the deployment",
    },
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain to upload the code on. Can be one of the chains available in the store",
    },
    wormholeContract: {
      type: "string",
      demandOption: true,
      desc: "Wormhole contract address deployed on this chain",
    },
  });

async function main() {
  const argv = await parser.argv;
  const { code, wormholeContract } = argv;
  console.log(
    await CosmWasmContract.deploy(
      DefaultStore.chains[argv.chain] as CosmWasmChain,
      wormholeContract,
      argv["private-key"],
      code
    )
  );
}

main();
