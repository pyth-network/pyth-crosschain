import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  AptosPriceFeedContract,
  CosmWasmPriceFeedContract,
  DefaultStore,
  EvmPriceFeedContract,
} from "../src";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0")
  .options({
    testnet: {
      type: "boolean",
      default: false,
      desc: "Fetch testnet contract fees instead of mainnet",
    },
  });

async function main() {
  const argv = await parser.argv;
  console.log(DefaultStore.tokens);

  const prices: Record<string, number> = {}
  for (const token of Object.values(DefaultStore.tokens)) {
    prices[token.id] = await token.getPrice();
  }

  let totalFeeUsd = 0;
  for (const contract of Object.values(DefaultStore.contracts)) {
    if (contract.getChain().isMainnet() === argv.testnet) continue;
    if (
      contract instanceof AptosPriceFeedContract ||
      contract instanceof EvmPriceFeedContract ||
      contract instanceof CosmWasmPriceFeedContract
    ) {
      try {
        const fee = await contract.getTotalFee();
        let feeUsd = 0;
        if (fee.denom !== undefined) {
          feeUsd = Number(fee.amount) * prices[fee.denom];
        }
        totalFeeUsd += feeUsd;

        console.log(`${contract.getId()} ${fee.amount} ${fee.denom} ($${feeUsd})`);
      } catch (e) {
        console.error(`Error fetching fees for ${contract.getId()}`, e);
      }
    }
  }

  console.log(`Total fees in USD: $${totalFeeUsd}`)
}

main();
