import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore } from "../src";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";

const parser = yargs(hideBin(process.argv))
  .scriptName("update_pricefeed.ts")
  .usage(
    "Usage: $0 --contract <contract_id> --feed-id <feed-id> --private-key <private-key>"
  )
  .options({
    contract: {
      type: "string",
      demandOption: true,
      desc: "Contract to update price feeds for",
    },
    "feed-id": {
      type: "string",
      demandOption: true,
      desc: "Price feed id to update",
    },
    "private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key to use to sign transaction",
    },
    endpoint: {
      type: "string",
      desc: "Price service endpoint to use, defaults to https://xc-mainnet.pyth.network for mainnet and https://xc-testnet.pyth.network for testnet",
    },
  });

async function main() {
  const argv = await parser.argv;
  const contract = DefaultStore.contracts[argv.contract];
  if (!contract) {
    throw new Error(`Contract ${argv.contract} not found`);
  }
  const defaultEndpoint = contract.getChain().isMainnet()
    ? "https://xc-mainnet.pyth.network"
    : "https://xc-testnet.pyth.network";
  const priceService = new PriceServiceConnection(
    argv.endpoint || defaultEndpoint
  );
  const vaas = await priceService.getLatestVaas([argv["feed-id"]]);
  await contract.executeUpdatePriceFeed(
    argv["private-key"],
    vaas.map((vaa) => Buffer.from(vaa, "base64"))
  );
}

main();
