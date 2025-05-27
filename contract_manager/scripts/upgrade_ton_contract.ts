import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src/node/utils/store";
import { TonPriceFeedContract } from "../src/core/contracts";
import { toPrivateKey } from "../src/core/base";
import fs from "fs";
import path from "path";
import { Cell } from "@ton/ton";

// This script upgrades the Pyth contract on TON after the governance has authorized the upgrade
// If you are starting over, the process is like the following:
// 1. create a governance proposal using generate_upgrade_ton_contract_proposal script
// 2. once approved and executed, relay it to TON using sync_governance_vaas script
// 3. upgrade the contract on TON using this script
const parser = yargs(hideBin(process.argv))
  .usage(
    "Upgrades the Pyth contract on TON and creates a governance proposal for it.\n" +
      "Usage: $0 --contract <contract_name> --private-key <private_key>",
  )
  .options({
    contract: {
      type: "string",
      description: "Contract name",
      demandOption: true,
    },
    "private-key": {
      type: "string",
      description: "Private key of the sender",
      demandOption: true,
    },
  });

async function main() {
  const argv = await parser.argv;

  const contract = DefaultStore.contracts[
    argv.contract
  ] as TonPriceFeedContract;

  // Read the compiled contract from the build directory
  // NOTE: Remember to rebuild contract_manager before running this script because it will also build the ton contract
  const compiledPath = path.resolve(
    __dirname,
    "../../target_chains/ton/contracts/build/Main.compiled.json",
  );
  const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf8"));
  const newCode = Cell.fromHex(compiled.hex);
  console.log(newCode);

  const tx = await contract.upgradeContract(
    toPrivateKey(argv["private-key"]),
    newCode,
  );
  console.log("Upgrade transaction:", tx);
}

main().catch((error) => {
  console.error("Error during upgrade:", error);
  process.exit(1);
});
