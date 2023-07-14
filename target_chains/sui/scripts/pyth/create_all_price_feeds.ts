import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import * as _ from "lodash";
import { Ed25519Keypair } from "@mysten/sui.js";

import { DefaultStore, SuiContract } from "@pythnetwork/pyth-contract-manager";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const parser = yargs(hideBin(process.argv))
  .scriptName("create_all_price_feeds.ts")
  .usage("Usage: $0 --contract <contract_id> --private-key <private_key>")
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
  });

async function main() {
  const argv = await parser.argv;
  const contract = DefaultStore.contracts[argv.contract] as SuiContract;
  const walletPrivateKey = argv["private-key"];
  const endpoint =
    contract.chain.getId() === "sui_mainnet"
      ? "https://xc-mainnet.pyth.network"
      : "https://xc-testnet.pyth.network";
  const connection = new PriceServiceConnection(endpoint, {
    priceFeedRequestConfig: {
      binary: true,
    },
  });
  const keypair = Ed25519Keypair.fromSecretKey(
    Buffer.from(walletPrivateKey, "hex")
  );
  console.log("wallet address: ", keypair.getPublicKey().toSuiAddress());

  // Fetch all price IDs
  const price_feed_ids = await connection.getPriceFeedIds();
  console.log("num price feed ids: ", price_feed_ids.length);

  // Create price feeds 20 at a time
  for (let chunk of _.chunk(price_feed_ids, 20)) {
    const priceFeedVAAs = await connection.getLatestVaas(chunk);
    console.log("price feed VAAs len: ", priceFeedVAAs.length);
    console.log("sample vaa: ", priceFeedVAAs[0]);
    for (let vaa of priceFeedVAAs) {
      const result = await contract.executeCreatePriceFeeds(
        keypair,
        Buffer.from(vaa, "base64")
      );
      console.log(result);
    }
  }
}

main();
