import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { CosmWasmChain } from "../src/chains";
import { CosmWasmPriceFeedContract } from "../src/contracts/cosmwasm";
import { DefaultStore, createStore } from "../src/store";
import { toPrivateKey } from "../src";
import { COMMON_STORE_OPTIONS } from "./common";

interface ArgV {
  code: string;
  "private-key": string;
  chain: string;
  "store-dir"?: string;
}

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --code <path/to/artifact.wasm> --private-key <private-key> --chain <chain> [--store-dir <store-dir>]"
  )
  .options({
    ...COMMON_STORE_OPTIONS,
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
  const argv = (await parser.argv) as ArgV;
  const store = createStore(argv["store-dir"]);
  const { code } = argv;
  const { codeId } = await CosmWasmPriceFeedContract.storeCode(
    store.chains[argv.chain] as CosmWasmChain,
    toPrivateKey(argv["private-key"]),
    code
  );
  console.log(`Successfully uploaded code with id ${codeId}`);
}

main();
