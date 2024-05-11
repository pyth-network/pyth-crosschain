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
  const argv = await parser.argv;
  const chain = argv.chain;
  const fee = argv.fee;
  const exponent = argv.exponent;

  const chain_obj: Chain = DefaultStore.chains[chain];

  const payload = chain_obj.generateGovernanceSetFeePayload(fee, exponent);
  console.log(
    `Generated payload for chain ${chain_obj}:`,
    payload.toString("hex")
  );
}

main();
