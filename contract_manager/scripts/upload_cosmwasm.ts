/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toPrivateKey } from "../src/core/base";
import type { CosmWasmChain } from "../src/core/chains";
import { CosmWasmPriceFeedContract } from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --code <path/to/artifact.wasm> --private-key <private-key> --chain <chain>",
  )
  .options({
    chain: {
      demandOption: true,
      desc: "Chain to upload the code on. Can be one of the chains available in the store",
      type: "string",
    },
    code: {
      demandOption: true,
      desc: "Path to the artifact .wasm file",
      type: "string",
    },
    "private-key": {
      demandOption: true,
      desc: "Private key to use for the deployment",
      type: "string",
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
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
