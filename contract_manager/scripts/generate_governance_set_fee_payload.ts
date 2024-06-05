import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src";
import { Chain } from "../src/chains";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 --chain <chain_id> --fee <fee> --exponent <exponent>")
  .options({
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain for which to generate the Set Fee payload",
    },
    fee: {
      type: "number",
      demandOption: true,
      desc: "The new fee to set",
    },
    exponent: {
      type: "number",
      demandOption: true,
      desc: "The new fee exponent to set",
    },
  });

async function main() {
  const { chain, fee, exponent } = await parser.argv;

  const chain_obj = DefaultStore.chains[chain];
  if (!chain_obj) {
    throw new Error(`Chain with ID '${chain}' does not exist.`);
  }

  const payload = chain_obj.generateGovernanceSetFeePayload(fee, exponent);
  console.log(
    `Generated payload for chain ${chain_obj}:`,
    payload.toString("hex")
  );
}

main();
