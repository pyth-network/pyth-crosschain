import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, TonPriceFeedContract, toPrivateKey } from "../src";
import fs from "fs";
import path from "path";
import { Cell } from "@ton/ton";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Upgrades the Pyth contract on TON and creates a governance proposal for it.\n" +
      "Usage: $0 --network <mainnet|testnet> --contract <contract_name> --private-key <private_key>"
  )
  .options({
    network: {
      type: "string",
      choices: ["mainnet", "testnet"],
      description: "Network to deploy to",
      demandOption: true,
    },
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
    "../../target_chains/ton/contracts/build/Main.compiled.json"
  );
  const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf8"));
  const newCode = Cell.fromHex(compiled.hex);
  console.log(newCode);

  const tx = await contract.upgradeContract(
    toPrivateKey(argv["private-key"]),
    newCode
  );
  console.log("Upgrade transaction:", tx);
}

main().catch((error) => {
  console.error("Error during upgrade:", error);
  process.exit(1);
});
