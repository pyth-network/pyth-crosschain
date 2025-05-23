import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { CosmWasmChain } from "../src/core/chains";
import { CosmWasmPriceFeedContract } from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";
import { toPrivateKey } from "../src/core/base";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --code <path/to/artifact.wasm> --private-key <private-key> --chain <chain>",
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
  });

async function main() {
  const argv = await parser.argv;
  const { code } = argv;
  const { codeId } = await CosmWasmPriceFeedContract.storeCode(
    DefaultStore.chains[argv.chain] as CosmWasmChain,
    toPrivateKey(argv["private-key"]),
    code,
  );
  console.log(`Successfully uploaded code with id ${codeId}`);
}

main();
