import { Ed25519Keypair } from "@mysten/sui.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, SuiContract } from "@pythnetwork/pyth-contract-manager";

const parser = yargs(hideBin(process.argv))
  .scriptName("create_price_feed.ts")
  .usage(
    "Usage: $0 --contract <contract_id> --private-key <private_key> --vaa <vaa>"
  )
  .options({
    contract: {
      type: "string",
      demandOption: true,
      desc: "Contract id to update",
    },
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key of the transaction signer in hex format without leading 0x",
    },
    vaa: {
      type: "string",
      demandOption: true,
      desc: "The price feed vaa to submit to the contract in base64 format",
    },
  });

async function main() {
  const argv = await parser.argv;
  const contract = DefaultStore.contracts[argv.contract] as SuiContract;
  const walletPrivateKey = argv["private-key"];

  const keypair = Ed25519Keypair.fromSecretKey(
    Buffer.from(walletPrivateKey, "hex")
  );
  console.log("wallet address: ", keypair.getPublicKey().toSuiAddress());
  const result = await contract.executeCreatePriceFeeds(
    keypair,
    Buffer.from(argv.vaa, "base64")
  );
  console.log(result);
}

main();
