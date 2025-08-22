/**
 * PythLazer EVM Contract Deployment and Management Script
 *
 * This script provides functionality to deploy PythLazer contracts and manage trusted signers
 * on EVM-compatible blockchains. It integrates with the DefaultStore system and supports
 * both deployment and contract management operations.
 *
 * FLAGS AND USAGE:
 *
 * 1. DEPLOYMENT FLAGS:
 *    --deploy                    Deploy the PythLazer contract (default: true)
 *    --verify                    Verify contract on block explorer after deployment
 *    --etherscan-api-key <key>   Required if --verify is true
 *
 * 2. TRUSTED SIGNER MANAGEMENT:
 *    --update-signer <address>   Address of the trusted signer to add/update
 *    --expires-at <timestamp>    Unix timestamp when the signer expires
 *
 * EXAMPLES:
 *
 * Deploy only:
 *   npx ts-node deploy_evm_lazer_contracts.ts --chain ethereum --private-key <key>
 *
 * Deploy with verification:
 *   npx ts-node deploy_evm_lazer_contracts.ts --chain ethereum --private-key <key> --verify --etherscan-api-key <key>
 *
 * Update trusted signer only (requires existing contract):
 *   npx ts-node deploy_evm_lazer_contracts.ts --chain ethereum --private-key <key> --deploy false --update-signer 0x123... --expires-at 1735689600
 *
 * Deploy and update trusted signer in one command:
 *   npx ts-node deploy_evm_lazer_contracts.ts --chain ethereum --private-key <key> --update-signer 0x123... --expires-at 1735689600
 *
 * NOTES:
 * - The --deploy flag defaults to true if no other flags are specified
 * - Both --update-signer and --expires-at must be provided together
 * - If updating trusted signer without deploying, an existing contract must be found
 * - The script automatically saves deployed contracts to the store and updates EvmLazerContracts.json
 * - All operations use the chain's RPC URL from the DefaultStore
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { execSync } from "child_process";
import { join } from "path";
import { DefaultStore } from "../src/node/utils/store";
import { EvmChain } from "../src/core/chains";
import { EvmLazerContract } from "../src/core/contracts/evm";
import { toPrivateKey, PrivateKey } from "../src/core/base";

const parser = yargs(hideBin(process.argv))
  .usage(
    "Deploys PythLazer contracts and/or updates trusted signers\n" +
      "Usage: $0 --chain <chain_name> --private-key <private_key> [--deploy] [--update-signer <address> --expires-at <timestamp>]",
  )
  .options({
    chain: {
      type: "string",
      description: "Chain name to deploy to (from EvmChains.json)",
      demandOption: true,
    },
    "private-key": {
      type: "string",
      description: "Private key for deployment and transactions",
      demandOption: true,
    },
    deploy: {
      type: "boolean",
      description:
        "Deploy the PythLazer contract (default: true if no other flags specified)",
      default: true,
    },
    verify: {
      type: "boolean",
      description:
        "Verify contract on block explorer (only used with --deploy)",
      default: false,
    },
    "etherscan-api-key": {
      type: "string",
      description:
        "Etherscan API key for verification (required if --verify is true)",
    },
    "update-signer": {
      type: "string",
      description: "Update trusted signer address (requires --expires-at)",
    },
    "expires-at": {
      type: "number",
      description:
        "Expiration timestamp for trusted signer in Unix timestamp format (required if --update-signer is specified)",
    },
  })
  .check((argv) => {
    // If update-signer is specified, expires-at must also be specified
    if (argv["update-signer"] && !argv["expires-at"]) {
      throw new Error(
        "--expires-at is required when --update-signer is specified",
      );
    }

    // If expires-at is specified, update-signer must also be specified
    if (argv["expires-at"] && !argv["update-signer"]) {
      throw new Error(
        "--update-signer is required when --expires-at is specified",
      );
    }

    // If verify is true, etherscan-api-key must be provided
    if (argv.verify && !argv["etherscan-api-key"]) {
      throw new Error("--etherscan-api-key is required when --verify is true");
    }

    return true;
  });

/**
 * Deploys the PythLazer contract using forge script
 * @param chain The EVM chain to deploy to
 * @param privateKey The private key for deployment
 * @param verify Whether to verify the contract
 * @param etherscanApiKey The Etherscan API key for verification
 * @returns The deployed contract address
 */
async function deployPythLazerContract(
  chain: EvmChain,
  privateKey: string,
  verify: boolean,
  etherscanApiKey?: string,
): Promise<string> {
  const lazerContractsDir = join(__dirname, "../../lazer/contracts/evm");
  const rpcUrl = chain.rpcUrl;

  console.log(`Deploying PythLazer contract to ${chain.getId()}...`);
  console.log(`RPC URL: ${rpcUrl}`);

  // Build forge command
  let forgeCommand = `forge script script/PythLazerDeploy.s.sol --rpc-url ${rpcUrl} --private-key ${privateKey} --broadcast`;

  if (verify && etherscanApiKey) {
    forgeCommand += ` --verify --etherscan-api-key ${etherscanApiKey}`;
  }

  try {
    // Execute forge script
    console.log("Running forge deployment script...");
    const output = execSync(forgeCommand, {
      cwd: lazerContractsDir,
      encoding: "utf8",
      stdio: "pipe",
    });

    console.log("Deployment output:");
    console.log(output);

    // Extract proxy address from output
    const proxyMatch = output.match(/Deployed proxy to: (0x[a-fA-F0-9]{40})/);
    if (!proxyMatch) {
      throw new Error("Could not extract proxy address from deployment output");
    }

    const proxyAddress = proxyMatch[1];
    console.log(`\nPythLazer proxy deployed at: ${proxyAddress}`);

    return proxyAddress;
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

/**
 * Updates the EvmLazerContracts.json file with the new deployment
 * @param chain The chain where the contract was deployed
 * @param address The deployed contract address
 */
function updateContractsFile(chain: EvmChain, address: string): void {
  console.log(`Updating contracts file for ${chain.getId()}`);
  const lazerContract = new EvmLazerContract(chain, address);
  DefaultStore.lazer_contracts[lazerContract.getId()] = lazerContract;
  DefaultStore.saveAllContracts();

  console.log(`\nUpdated EvmLazerContracts.json with new deployment`);
  console.log(`Chain: ${chain.getId()}`);
  console.log(`Address: ${address}`);
}

/**
 * Gets or creates an EvmLazerContract instance
 * @param chain The EVM chain
 * @param address The contract address
 * @returns The EvmLazerContract instance
 */
function getOrCreateLazerContract(
  chain: EvmChain,
  address: string,
): EvmLazerContract {
  return new EvmLazerContract(chain, address);
}

/**
 * Updates the trusted signer for a PythLazer contract
 * @param chain The EVM chain
 * @param contractAddress The contract address
 * @param trustedSigner The trusted signer address
 * @param expiresAt The expiration timestamp
 * @param privateKey The private key for the transaction
 */
async function updateTrustedSigner(
  chain: EvmChain,
  contractAddress: string,
  trustedSigner: string,
  expiresAt: number,
  privateKey: PrivateKey,
): Promise<void> {
  const contract = getOrCreateLazerContract(chain, contractAddress);
  await contract.updateTrustedSigner(trustedSigner, expiresAt, privateKey);
}

function findLazerContract(chain: EvmChain): EvmLazerContract | undefined {
  for (const contract of Object.values(DefaultStore.lazer_contracts)) {
    if (
      contract instanceof EvmLazerContract &&
      contract.chain.getId() === chain.getId()
    ) {
      console.log(
        `Found lazer contract for ${chain.getId()} at ${contract.address}`,
      );
      return contract;
    }
  }
}

export async function findOrDeployPythLazerContract(
  chain: EvmChain,
  privateKey: string,
  verify: boolean,
  etherscanApiKey?: string,
): Promise<string> {
  const lazerContract = findLazerContract(chain);
  if (lazerContract) {
    console.log(
      `Found lazer contract for ${chain.getId()} at ${lazerContract.address}`,
    );
    return lazerContract.address;
  }
  const deployedAddress = await deployPythLazerContract(
    chain,
    privateKey,
    verify,
    etherscanApiKey,
  );
  console.log(
    `✅ PythLazer contract deployed successfully at ${deployedAddress}`,
  );
  updateContractsFile(chain, deployedAddress);
  return deployedAddress;
}

export async function main() {
  const argv = await parser.argv;

  // Get the chain from the store
  const chain = DefaultStore.getChainOrThrow(argv.chain, EvmChain);

  try {
    let deployedAddress: string | undefined;

    // Step 1: Deploy contract if requested
    if (argv.deploy) {
      console.log(`Deploying PythLazer contract to ${chain.getId()}...`);
      console.log(`Chain: ${chain.getId()}`);
      console.log(`RPC URL: ${chain.rpcUrl}`);
      console.log(`Verification: ${argv.verify ? "Enabled" : "Disabled"}`);

      deployedAddress = await findOrDeployPythLazerContract(
        chain,
        argv["private-key"],
        argv.verify,
        argv["etherscan-api-key"],
      );
    }

    // Step 2: Update trusted signer if requested
    if (argv["update-signer"] && argv["expires-at"]) {
      console.log(`\nUpdating trusted signer on ${chain.getId()}...`);
      console.log(`Signer Address: ${argv["update-signer"]}`);
      console.log(
        `Expires At: ${new Date(argv["expires-at"] * 1000).toISOString()}`,
      );

      let contractAddress: string;

      // Use deployed address if we just deployed, otherwise find existing contract
      if (deployedAddress) {
        contractAddress = deployedAddress;
        console.log(`Using newly deployed contract at ${contractAddress}`);
      } else {
        const lazerContract = findLazerContract(chain);
        if (lazerContract) {
          contractAddress = lazerContract.address;
          console.log(`Using existing contract at ${contractAddress}`);
        } else {
          throw new Error(
            `No lazer contract found for ${chain.getId()}. Deploy a contract first using --deploy.`,
          );
        }
      }

      await updateTrustedSigner(
        chain,
        contractAddress,
        argv["update-signer"],
        argv["expires-at"],
        toPrivateKey(argv["private-key"]),
      );

      console.log(`\n✅ Trusted signer updated successfully`);
    }

    // Summary
    console.log(`\n Operation Summary:`);
    if (argv.deploy && argv["update-signer"]) {
      console.log(`\n✅ Contract deployed at: ${deployedAddress}`);
      console.log(`Trusted signer updated: ${argv["update-signer"]}`);
      console.log(
        `Expires at: ${new Date((argv["expires-at"] ?? 0) * 1000).toISOString()}`,
      );
    } else if (argv.deploy) {
      console.log(`Contract deployed at ${deployedAddress}`);
    } else if (argv["update-signer"]) {
      console.log(`Trusted signer updated successfully`);
    } else {
      console.log(
        `No operations performed. Use --deploy to deploy or --update-signer to update trusted signer.`,
      );
    }
  } catch (error) {
    console.error("Operation failed:", error);
    process.exit(1);
  }
}

main();
