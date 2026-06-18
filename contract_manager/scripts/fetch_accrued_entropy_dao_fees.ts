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
  console.log("\n=== Accrued Entropy DAO Fees Summary ===\n");

  const successfulResults = results.filter((r) => !r.error);
  const failedResults = results.filter((r) => r.error);

  // Summary statistics
  console.log("SUMMARY:");
  console.log("─".repeat(40));
  console.log(`Total Chains Checked: ${results.length}`);
  console.log(`Successful Queries:   ${successfulResults.length}`);
  console.log(`Failed Queries:       ${failedResults.length}`);
  console.log("");

  if (successfulResults.length > 0) {
    console.log("Successful Queries:");
    console.table(
      successfulResults.map((r) => {
        const baseData = {
          Chain: r.chainId,
          "Fees (Wei)": r.accruedFees,
          Network: r.isMainnet ? "Mainnet" : "Testnet",
        };

        if (showEth && r.accruedFeesEth) {
          return {
            ...baseData,
            "Fees (ETH)": r.accruedFeesEth,
          };
        }

        return baseData;
      }),
    );
  }

  if (failedResults.length > 0) {
    console.log("\nFailed Queries:");
    console.table(
      failedResults.map((r) => ({
        Chain: r.chainId,
        Error: r.error,
        Network: r.isMainnet ? "Mainnet" : "Testnet",
      })),
    );
  }
}

async function main() {
  const argv = await parser.argv;
  const results: FeeResult[] = [];

  console.log("Fetching accrued entropy DAO fees from entropy contracts...\n");

  if (argv.chain) {
    // Fetch fees for a specific chain
    try {
      const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);
      const contract = findEntropyContract(chain);
      console.log(`Fetching fees for ${argv.chain}...`);
      const result = await fetchAccruedFees(contract, argv.showEth);
      results.push(result);
    } catch (error) {
      console.error(
        `Error fetching fees for ${argv.chain}:`,
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  } else if (argv["all-chains"]) {
    // Fetch fees for all chains based on network type
    const contracts = Object.values(DefaultStore.entropy_contracts);

    if (contracts.length === 0) {
      console.log("No entropy contracts found in the store.");
      return;
    }

    console.log(`Found ${contracts.length} entropy contract(s) in the store.`);

    for (const contract of contracts) {
      const chainId = contract.getChain().getId();
      const isMainnet = contract.getChain().isMainnet();

      // Filter based on network type
      if (argv["all-chains"] === "mainnet" && !isMainnet) continue;
      if (argv["all-chains"] === "testnet" && isMainnet) continue;
      // If "all", we include both mainnet and testnet

      console.log(`Fetching fees for ${chainId}...`);
      const result = await fetchAccruedFees(contract, argv.showEth);
      results.push(result);
    }
  }

  if (results.length === 0) {
    console.log("No matching contracts found for the specified criteria.");
    return;
  }

  formatResults(results, argv.showEth);
}

main().catch((error) => {
  console.error(
    "Script failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
