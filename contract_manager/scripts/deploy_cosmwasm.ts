/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/no-floating-promises */

/* eslint-disable unicorn/prefer-top-level-await */

/* eslint-disable no-console */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { COMMON_DEPLOY_OPTIONS } from "./common";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_cosmwasm.ts")
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
    "private-key": COMMON_DEPLOY_OPTIONS["private-key"],
    wormholeContract: {
      demandOption: true,
      desc: "Wormhole contract address deployed on this chain",
      type: "string",
    },
  });

async function main() {
  const argv = await parser.argv;
  const { code, wormholeContract } = argv;
}

main();
