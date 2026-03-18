/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { toPrivateKey } from "../src/core/base";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --contract <contract_id> --feed-id <feed-id> --private-key <private-key>",
  )
  .options({
    contract: {
      demandOption: true,
      desc: "Contract to update price feeds for (e.g mumbai_0xff1a0f4744e8582DF1aE09D5611b887B6a12925C)",
      type: "string",
    },
    endpoint: {
      desc: "Hermes endpoint to use, defaults to https://hermes.pyth.network",
      type: "string",
    },
    "feed-id": {
      demandOption: true,
      desc: "Price feed ids to update without the leading 0x (e.g f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b). Can be provided multiple times for multiple feed updates",
      type: "array",
    },
    "private-key": {
      demandOption: true,
      desc: "Private key to use to sign transaction",
      type: "string",
    },
  });

async function main() {
  const argv = await parser.argv;
  const contract = DefaultStore.contracts[argv.contract];
  if (!contract) {
    throw new Error(
      `Contract ${argv.contract} not found. Contracts found: ${Object.keys(
        DefaultStore.contracts,
      ).join(" ")}`,
    );
  }
  const priceService = new PriceServiceConnection(
    argv.endpoint || "https://hermes.pyth.network",
  );
  const _vaas = await priceService.getLatestVaas(argv["feed-id"] as string[]);
  const _privateKey = toPrivateKey(argv["private-key"]);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
