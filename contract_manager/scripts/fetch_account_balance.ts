/* eslint-disable @typescript-eslint/no-floating-promises */

/* eslint-disable unicorn/prefer-top-level-await */

/* eslint-disable no-console */
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { PrivateKey } from "../src/core/base";
import { toPrivateKey } from "../src/core/base";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --private-key <private-key> [--chain <chain>]")
  .options({
    chain: {
      desc: "Chain to get the balance for. If not provided the balance for all chains is returned.",
      string: true,
      type: "array",
    },
    "private-key": {
      demandOption: true,
      desc: "Private key to use to sign transaction",
      type: "string",
    },
  });

type AccountBalance = {
  chain: string;
  address: string | undefined;
  balance: number | undefined;
};

async function getBalance(
  chain: string,
  privateKey: PrivateKey,
): Promise<AccountBalance | undefined> {
  const address =
    await DefaultStore.chains[chain]?.getAccountAddress(privateKey);

  try {
    const balance =
      await DefaultStore.chains[chain]?.getAccountBalance(privateKey);
    return { address, balance, chain };
  } catch (_error) {
    // Ignore errors and return undefined balance
  }
  return { address, balance: undefined, chain };
}

async function main() {
  const argv = await parser.argv;
  const chains =
    argv.chain ??
    Object.keys(DefaultStore.chains).filter((chain) => chain !== "global");

  const privateKey = toPrivateKey(argv["private-key"]);

  const _balances = await Promise.all(
    chains.map((chain) => getBalance(chain, privateKey)),
  );
}

main();
