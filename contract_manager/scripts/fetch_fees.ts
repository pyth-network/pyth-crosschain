import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  AptosPriceFeedContract,
  CosmWasmPriceFeedContract,
  EvmPriceFeedContract,
  TonPriceFeedContract,
} from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";

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

  const prices: Record<string, number> = {};
  for (const token of Object.values(DefaultStore.tokens)) {
    const price = await token.getPriceForMinUnit();
    // We're going to ignore the value of tokens that aren't configured
    // in the store -- these are likely not worth much anyway.
    if (price !== undefined) {
      prices[token.id] = price;
    }
  }

  let totalFeeUsd = 0;
  for (const contract of Object.values(DefaultStore.contracts)) {
    if (contract.getChain().isMainnet() === argv.testnet) continue;
    if (
      contract instanceof AptosPriceFeedContract ||
      contract instanceof EvmPriceFeedContract ||
      contract instanceof CosmWasmPriceFeedContract ||
      contract instanceof TonPriceFeedContract
    ) {
      try {
        const fee = await contract.getTotalFee();
        let feeUsd = 0;
        if (fee.denom !== undefined && prices[fee.denom] !== undefined) {
          feeUsd = Number(fee.amount) * prices[fee.denom];
          totalFeeUsd += feeUsd;
          console.log(
            `${contract.getId()} ${fee.amount} ${fee.denom} ($${feeUsd})`,
          );
        } else {
          console.log(
            `${contract.getId()} ${fee.amount} ${fee.denom} ($ value unknown)`,
          );
        }
      } catch (e) {
        console.error(`Error fetching fees for ${contract.getId()}`, e);
      }
    }
  }

  console.log(`Total fees in USD: $${totalFeeUsd}`);
}

main();
