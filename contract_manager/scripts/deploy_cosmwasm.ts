import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { CosmWasmChain } from "../src/core/chains";
import { CosmWasmPriceFeedContract } from "../src/core/contracts/cosmwasm";
import { DefaultStore } from "../src/node/utils/store";

import { COMMON_DEPLOY_OPTIONS } from "./common";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_cosmwasm.ts")
  .usage(
    "Usage: $0 --code <path/to/artifact.wasm> --private-key <private-key> --chain <chain>",
  )
  .options({
    code: {
      type: "string",
      demandOption: true,
      desc: "Path to the artifact .wasm file",
    },
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
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
    await CosmWasmPriceFeedContract.deploy(
      DefaultStore.chains[argv.chain] as CosmWasmChain,
      wormholeContract,
      argv["private-key"],
      code,
    ),
  );
}

main();
