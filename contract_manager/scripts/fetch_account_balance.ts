import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { PrivateKey, toPrivateKey } from "../src/core/base";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --private-key <private-key> [--chain <chain>]")
  .options({
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to use to sign transaction",
    },
    chain: {
      type: "array",
      string: true,
      desc: "Chain to get the balance for. If not provided the balance for all chains is returned.",
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
    await DefaultStore.chains[chain].getAccountAddress(privateKey);

  try {
    const balance =
      await DefaultStore.chains[chain].getAccountBalance(privateKey);
    return { chain, address, balance };
  } catch (e) {
    console.error(`Error fetching balance for ${chain}`, e);
  }
  return { chain, address, balance: undefined };
}

async function main() {
  const argv = await parser.argv;
  const chains = argv.chain
    ? argv.chain
    : Object.keys(DefaultStore.chains).filter((chain) => chain !== "global");

  const privateKey = toPrivateKey(argv["private-key"]);

  const balances = await Promise.all(
    chains.map((chain) => getBalance(chain, privateKey)),
  );

  console.table(balances);
}

main();
