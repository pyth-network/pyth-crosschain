import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { DefaultStore, SuiContract } from "contract_manager";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Usage: $0 --contract <contract_id> --feed-id <feed-id> --private-key <private-key>"
  )
  .options({
    contract: {
      type: "string",
      demandOption: true,
      desc: "Contract to update price feeds for (e.g sui_testnet_0xe8c2ddcd5b10e8ed98e53b12fcf8f0f6fd9315f810ae61fa4001858851f21c88)",
    },
    "feed-id": {
      type: "array",
      demandOption: true,
      desc: "Price feed ids to create without the leading 0x (e.g f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b). Can be provided multiple times for multiple feed updates",
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
  const contract = DefaultStore.contracts[argv.contract] as SuiContract;
  if (!contract) {
    throw new Error(`Contract ${argv.contract} not found`);
  }
  const defaultEndpoint = contract.getChain().isMainnet()
    ? "https://xc-mainnet.pyth.network"
    : "https://xc-testnet.pyth.network";
  const priceService = new PriceServiceConnection(
    argv.endpoint || defaultEndpoint
  );
  const feedIds = argv["feed-id"] as string[];
  const vaas = await priceService.getLatestVaas(feedIds);
  const digest = await contract.executeCreatePriceFeed(
    argv["private-key"],
    vaas.map((vaa) => Buffer.from(vaa, "base64"))
  );
  console.log("Transaction successful. Digest:", digest);
}

main();
