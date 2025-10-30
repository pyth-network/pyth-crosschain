/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable unicorn/no-nested-ternary */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable no-console */
import Web3 from "web3";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { PrivateKey } from "../src/core/base";
import { toPrivateKey } from "../src/core/base";
import { EvmChain } from "../src/core/chains";
import { DefaultStore } from "../src/node/utils/store";

type TransferResult = {
  chain: string;
  success: boolean;
  sourceAddress: string;
  destinationAddress: string;
  originalBalance: string;
  transferAmount: string;
  remainingBalance: string;
  transactionHash?: string;
  error?: string;
};

const parser = yargs(hideBin(process.argv))
  .usage(
    "Multi-Chain Balance Transfer Tool for Pyth Entropy Chains\n\nUsage: $0 --source-private-key <key> --destination-address <addr> [chain-selection] [transfer-method] [options]",
  )
  .options({
    "source-private-key": {
      type: "string",
      demandOption: true,
      desc: "Private key of the source wallet to transfer from",
    },
    "destination-address": {
      type: "string",
      demandOption: true,
      desc: "Public address of the destination wallet",
    },
    chain: {
      type: "array",
      string: true,
      desc: "Specific chain IDs to transfer on (e.g., --chain optimism_sepolia --chain avalanche)",
    },
    testnets: {
      type: "boolean",
      default: false,
      desc: "Transfer on all testnet entropy chains",
    },
    mainnets: {
      type: "boolean",
      default: false,
      desc: "Transfer on all mainnet entropy chains",
    },
    amount: {
      type: "number",
      desc: "Exact amount in ETH to transfer from each chain",
    },
    ratio: {
      type: "number",
      desc: "Ratio of available balance to transfer (0-1, e.g., 0.5 for half, 1.0 for all)",
    },
    "min-balance": {
      type: "number",
      default: 0.001,
      desc: "Minimum balance in ETH required before attempting transfer",
    },
    "gas-multiplier": {
      type: "number",
      default: 2,
      desc: "Gas multiplier for transaction safety",
    },
    "dry-run": {
      type: "boolean",
      default: false,
      desc: "Preview transfers without executing transactions",
    },
  })
  .group(
    ["chain", "testnets", "mainnets"],
    "Chain Selection (choose exactly one):",
  )
  .group(["amount", "ratio"], "Transfer Method (choose exactly one):")
  .group(["min-balance", "gas-multiplier", "dry-run"], "Optional Parameters:")
  .example([
    [
      "$0 --source-private-key abc123... --destination-address 0x742d35... --mainnets --amount 0.1",
      "Transfer 0.1 ETH from all mainnet chains",
    ],
    [
      "$0 --source-private-key abc123... --destination-address 0x742d35... --testnets --ratio 0.75",
      "Transfer 75% of balance from all testnet chains",
    ],
    [
      "$0 --source-private-key abc123... --destination-address 0x742d35... --chain ethereum --chain avalanche --amount 0.05",
      "Transfer 0.05 ETH from specific chains",
    ],
    [
      "$0 --source-private-key abc123... --destination-address 0x742d35... --testnets --ratio 0.5 --dry-run",
      "Preview 50% transfer on all testnet chains",
    ],
  ])
  .help()
  .alias("help", "h")
  .version(false);

async function transferOnChain(
  chain: EvmChain,
  sourcePrivateKey: PrivateKey,
  destinationAddress: string,
  minBalance: number,
  gasMultiplier: number,
  dryRun: boolean,
  transferAmount?: number,
  transferRatio?: number,
): Promise<TransferResult> {
  const web3 = chain.getWeb3();
  const signer = web3.eth.accounts.privateKeyToAccount(sourcePrivateKey);
  const sourceAddress = signer.address;

  try {
    // Get balance
    const balanceWei = await web3.eth.getBalance(sourceAddress);
    const balanceEth = Number(web3.utils.fromWei(balanceWei, "ether"));

    console.log(`\n${chain.getId()}: Checking balance for ${sourceAddress}`);
    console.log(`   Balance: ${balanceEth.toFixed(6)} ETH`);

    if (balanceEth < minBalance) {
      console.log(
        `   Balance below minimum threshold (${minBalance} ETH), skipping`,
      );
      return {
        chain: chain.getId(),
        success: false,
        sourceAddress,
        destinationAddress,
        originalBalance: balanceEth.toFixed(6),
        transferAmount: "0",
        remainingBalance: balanceEth.toFixed(6),
        error: `Balance ${balanceEth.toFixed(6)} ETH below minimum ${minBalance} ETH`,
      };
    }

    // Calculate gas costs
    const gasPrice = await web3.eth.getGasPrice();
    const estimatedGas = await web3.eth.estimateGas({
      from: sourceAddress,
      to: destinationAddress,
      value: "1", // Minimal value for estimation
    });

    const gasCostWei =
      BigInt(estimatedGas) * BigInt(gasPrice) * BigInt(gasMultiplier);
    const gasCostEth = Number(
      web3.utils.fromWei(gasCostWei.toString(), "ether"),
    );

    // Calculate transfer amount
    let transferAmountEth: number;
    if (transferAmount === undefined) {
      // transferRatio is guaranteed to be defined at this point
      if (transferRatio === undefined) {
        throw new Error(
          "Transfer ratio must be defined when amount is not specified",
        );
      }
      transferAmountEth = (balanceEth - gasCostEth) * transferRatio;
    } else {
      transferAmountEth = transferAmount;
    }

    // Round to 10 decimal places to avoid Web3 conversion errors
    transferAmountEth = Math.round(transferAmountEth * 1e10) / 1e10;

    // Validate transfer amount
    if (transferAmountEth <= 0) {
      console.log(
        `   Not enough balance to cover transfer and gas costs, skipping`,
      );
      return {
        chain: chain.getId(),
        success: false,
        sourceAddress,
        destinationAddress,
        originalBalance: balanceEth.toFixed(6),
        transferAmount: "0",
        remainingBalance: balanceEth.toFixed(6),
        error: `Insufficient balance for transfer amount and gas costs (${gasCostEth.toFixed(6)} ETH)`,
      };
    }

    if (transferAmountEth + gasCostEth > balanceEth) {
      console.log(`   Transfer amount plus gas costs exceed balance, skipping`);
      return {
        chain: chain.getId(),
        success: false,
        sourceAddress,
        destinationAddress,
        originalBalance: balanceEth.toFixed(6),
        transferAmount: "0",
        remainingBalance: balanceEth.toFixed(6),
        error: `Transfer amount ${transferAmountEth.toFixed(6)} ETH plus gas ${gasCostEth.toFixed(6)} ETH exceeds balance`,
      };
    }

    const transferAmountWei = web3.utils.toWei(
      transferAmountEth.toString(),
      "ether",
    );

    console.log(`   Transfer amount: ${transferAmountEth.toFixed(6)} ETH`);
    console.log(`   Estimated gas cost: ${gasCostEth.toFixed(6)} ETH`);
    console.log(`   Destination: ${destinationAddress}`);

    if (dryRun) {
      console.log(
        `   DRY RUN: Would transfer ${transferAmountEth.toFixed(6)} ETH`,
      );
      return {
        chain: chain.getId(),
        success: true,
        sourceAddress,
        destinationAddress,
        originalBalance: balanceEth.toFixed(6),
        transferAmount: transferAmountEth.toFixed(6),
        remainingBalance: (balanceEth - transferAmountEth).toFixed(6),
      };
    }

    // Perform the transfer
    web3.eth.accounts.wallet.add(signer);

    console.log(`   Executing transfer...`);
    const tx = await web3.eth.sendTransaction({
      from: sourceAddress,
      to: destinationAddress,
      value: transferAmountWei,
      gas: Number(estimatedGas) * gasMultiplier,
      gasPrice: gasPrice,
    });

    // Get updated balance
    const newBalanceWei = await web3.eth.getBalance(sourceAddress);
    const newBalanceEth = Number(web3.utils.fromWei(newBalanceWei, "ether"));

    console.log(`   Transfer successful!`);
    console.log(`   Transaction hash: ${tx.transactionHash}`);
    console.log(`   New balance: ${newBalanceEth.toFixed(6)} ETH`);

    return {
      chain: chain.getId(),
      success: true,
      sourceAddress,
      destinationAddress,
      originalBalance: balanceEth.toFixed(6),
      transferAmount: transferAmountEth.toFixed(6),
      remainingBalance: newBalanceEth.toFixed(6),
      transactionHash: tx.transactionHash,
    };
  } catch (error) {
    console.log(`   Transfer failed: ${error}`);
    return {
      chain: chain.getId(),
      success: false,
      sourceAddress,
      destinationAddress,
      originalBalance: "unknown",
      transferAmount: "0",
      remainingBalance: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getSelectedChains(argv: {
  chain?: string[];
  testnets: boolean;
  mainnets: boolean;
}): EvmChain[] {
  // Check for mutually exclusive options
  const optionCount =
    (argv.testnets ? 1 : 0) + (argv.mainnets ? 1 : 0) + (argv.chain ? 1 : 0);
  if (optionCount !== 1) {
    throw new Error(
      "Must specify exactly one of: --testnets, --mainnets, or --chain",
    );
  }

  // Get all entropy contract chains
  const allEntropyChains: EvmChain[] = [];
  for (const contract of Object.values(DefaultStore.entropy_contracts)) {
    const chain = contract.getChain();
    if (chain instanceof EvmChain) {
      allEntropyChains.push(chain);
    }
  }

  let selectedChains: EvmChain[];

  if (argv.testnets) {
    selectedChains = allEntropyChains.filter((chain) => !chain.isMainnet());
  } else if (argv.mainnets) {
    selectedChains = allEntropyChains.filter((chain) => chain.isMainnet());
  } else {
    // Specific chains
    const entropyChainIds = new Set(
      allEntropyChains.map((chain) => chain.getId()),
    );
    selectedChains = [];

    if (!argv.chain) {
      throw new Error(
        "Chain argument must be defined for specific chain selection",
      );
    }
    for (const chainId of argv.chain) {
      if (!entropyChainIds.has(chainId)) {
        throw new Error(
          `Chain ${chainId} does not have entropy contracts deployed`,
        );
      }
      const chain = DefaultStore.chains[chainId];
      if (!(chain instanceof EvmChain)) {
        throw new TypeError(`Chain ${chainId} is not an EVM chain`);
      }
      selectedChains.push(chain);
    }
  }

  if (selectedChains.length === 0) {
    const mode = argv.testnets
      ? "testnet"
      : argv.mainnets
        ? "mainnet"
        : "specified";
    throw new Error(`No valid ${mode} entropy chains found`);
  }

  return selectedChains;
}

async function main() {
  const argv = await parser.argv;

  // Validate inputs
  if (!Web3.utils.isAddress(argv.destinationAddress)) {
    throw new Error("Invalid destination address format");
  }

  // Validate transfer amount options
  if (argv.amount !== undefined && argv.ratio !== undefined) {
    throw new Error("Cannot specify both --amount and --ratio options");
  }

  if (argv.amount === undefined && argv.ratio === undefined) {
    throw new Error("Must specify either --amount or --ratio option");
  }

  if (argv.ratio !== undefined && (argv.ratio <= 0 || argv.ratio > 1)) {
    throw new Error(
      "Ratio must be between 0 and 1 (exclusive of 0, inclusive of 1)",
    );
  }

  if (argv.amount !== undefined && argv.amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const sourcePrivateKey = toPrivateKey(argv.sourcePrivateKey);
  // @ts-expect-error - TODO: Typing mismatch between argv and the expected array type for getSelectedChains()
  const selectedChains = getSelectedChains(argv);

  // Determine transfer method for display
  let transferMethod: string;
  if (argv.amount === undefined) {
    if (argv.ratio === undefined) {
      throw new Error("Ratio must be defined when amount is not specified");
    }
    transferMethod = `${(argv.ratio * 100).toFixed(1)}% of available balance`;
  } else {
    transferMethod = `${argv.amount} ETH (fixed amount)`;
  }

  console.log(`\nConfiguration:`);
  console.log(
    `   Network: ${argv.testnets ? "Testnet" : argv.mainnets ? "Mainnet" : "Specific chains"}`,
  );
  console.log(`   Destination: ${argv.destinationAddress}`);
  console.log(`   Transfer method: ${transferMethod}`);
  console.log(`   Minimum balance: ${argv.minBalance} ETH`);
  console.log(`   Gas multiplier: ${argv.gasMultiplier}x`);
  console.log(`   Dry run: ${argv.dryRun ? "Yes" : "No"}`);
  console.log(`   Chains: ${selectedChains.map((c) => c.getId()).join(", ")}`);

  if (argv.dryRun) {
    console.log(`\nRUNNING IN DRY-RUN MODE - NO TRANSACTIONS WILL BE EXECUTED`);
  }

  const results: TransferResult[] = [];

  // Process each chain
  for (const chain of selectedChains) {
    const result = await transferOnChain(
      chain,
      sourcePrivateKey,
      argv.destinationAddress,
      argv.minBalance,
      argv.gasMultiplier,
      argv.dryRun,
      argv.amount,
      argv.ratio,
    );
    results.push(result);
  }

  // Summary
  console.log("\nTRANSFER SUMMARY");
  console.log("==================");

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`Successful transfers: ${successful.length}`);
  console.log(`Failed transfers: ${failed.length}`);
  console.log(
    `Total transferred: ${successful.reduce((sum, r) => sum + Number.parseFloat(r.transferAmount), 0).toFixed(6)} ETH`,
  );

  if (successful.length > 0) {
    console.log("\nSuccessful Transfers:");
    console.table(
      successful.map((r) => ({
        Chain: r.chain,
        "Transfer Amount (ETH)": r.transferAmount,
        "TX Hash": r.transactionHash || "N/A (dry run)",
        "Remaining Balance (ETH)": r.remainingBalance,
      })),
    );
  }

  if (failed.length > 0) {
    console.log("\nFailed Transfers:");
    console.table(
      failed.map((r) => ({
        Chain: r.chain,
        "Original Balance (ETH)": r.originalBalance,
        Error: r.error,
      })),
    );
  }

  console.log("\nTransfer process completed!");
}

// eslint-disable-next-line unicorn/prefer-top-level-await, @typescript-eslint/use-unknown-in-catch-callback-variable
main().catch((error) => {
  console.error("Script failed:", error);
  // eslint-disable-next-line n/no-process-exit, unicorn/no-process-exit
  process.exit(1);
});
