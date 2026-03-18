/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable 
  unicorn/prefer-top-level-await,
  @typescript-eslint/restrict-template-expressions,
  no-console,
  unicorn/no-process-exit,
  n/no-process-exit
*/

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/core/chains";
import type { EvmEntropyContract } from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";
import { findEntropyContract } from "./common";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Fetches the accrued Pyth DAO fees for entropy contracts across chains.\n" +
      "Usage: $0 --chain <chain-id> | --all-chains <testnet|mainnet|all>",
  )
  .options({
    "all-chains": {
      choices: ["testnet", "mainnet", "all"],
      conflicts: "chain",
      desc: "Fetch accrued fees for all entropy contracts deployed on specified network type",
      type: "string",
    },
    chain: {
      conflicts: "all-chains",
      desc: "Fetch accrued fees for the entropy contract on this specific chain",
      type: "string",
    },
    "show-eth": {
      default: false,
      desc: "Show fees in ETH in addition to Wei",
      type: "boolean",
    },
  })
  .check((argv) => {
    if (!argv.chain && !argv["all-chains"]) {
      throw new Error("Must specify either --chain or --all-chains");
    }
    return true;
  });

type FeeResult = {
  chainId: string;
  contractAddress: string;
  accruedFees: string;
  accruedFeesEth?: string | undefined;
  isMainnet: boolean;
  error?: string;
};

async function fetchAccruedFees(
  contract: EvmEntropyContract,
  showEth: boolean,
): Promise<FeeResult> {
  const chainId = contract.getChain().getId();
  const contractAddress = contract.address;
  const isMainnet = contract.getChain().isMainnet();

  try {
    const accruedFeesWei = await contract.getAccruedPythFees();
    let accruedFeesEth: string | undefined;

    if (showEth) {
      const web3 = contract.getChain().getWeb3();
      accruedFeesEth = web3.utils.fromWei(accruedFeesWei, "ether");
    }

    return {
      accruedFees: accruedFeesWei,
      accruedFeesEth,
      chainId,
      contractAddress,
      isMainnet,
    };
  } catch (error) {
    return {
      accruedFees: "0",
      accruedFeesEth: showEth ? "0" : undefined,
      chainId,
      contractAddress,
      error: error instanceof Error ? error.message : "Unknown error",
      isMainnet,
    };
  }
}

function formatResults(results: FeeResult[], showEth: boolean): void {
  const successfulResults = results.filter((r) => !r.error);
  const failedResults = results.filter((r) => r.error);

  if (successfulResults.length > 0) {
    /* legacy no-op */
  }

  if (failedResults.length > 0) {
    /* legacy no-op */
  }
}

async function main() {
  const argv = await parser.argv;
  const results: FeeResult[] = [];

  if (argv.chain) {
    // Fetch fees for a specific chain
    try {
      const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
      const contract = findEntropyContract(chain);
      const result = await fetchAccruedFees(contract, argv.showEth);
      results.push(result);
    } catch (_error) {
      process.exit(1);
    }
  } else if (argv["all-chains"]) {
    // Fetch fees for all chains based on network type
    const contracts = Object.values(DefaultStore.entropy_contracts);

    if (contracts.length === 0) {
      return;
    }

    for (const contract of contracts) {
      const _chainId = contract.getChain().getId();
      const isMainnet = contract.getChain().isMainnet();

      // Filter based on network type
      if (argv["all-chains"] === "mainnet" && !isMainnet) continue;
      if (argv["all-chains"] === "testnet" && isMainnet) continue;
      const result = await fetchAccruedFees(contract, argv.showEth);
      results.push(result);
    }
  }

  if (results.length === 0) {
    return;
  }

  formatResults(results, argv.showEth);
}

main().catch(() => {
  process.exit(1);
});
