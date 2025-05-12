import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { PythCluster } from "@pythnetwork/client";
import {
  ValidationResult,
  DownloadableProduct,
  LazerInstructionAccounts,
} from "../types";
import { ProgramType, PROGRAM_TYPE_NAMES } from "../types";

/**
 * Program ID for the Pyth Lazer program
 */
const LAZER_PROGRAM_ID = new PublicKey(
  "pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt",
);

/**
 * Get the program address for the given cluster
 *
 * @param cluster The Pyth cluster to get the address for
 * @returns The program address
 */
export function getProgramAddress(cluster: PythCluster): PublicKey {
  // Currently using the same mock address for all clusters
  // Will be updated with actual addresses for each cluster when available
  return LAZER_PROGRAM_ID;
}

/**
 * Check if the Pyth Lazer program is available on the specified cluster
 *
 * @param cluster The Pyth cluster to check
 * @returns True if the program is available on the cluster
 */
export function isAvailableOnCluster(cluster: PythCluster): boolean {
  return (
    cluster === "pythnet" ||
    cluster === "mainnet-beta" ||
    cluster === "devnet" ||
    cluster === "testnet"
  );
}

/**
 * Parse raw on-chain accounts into a configuration object
 *
 * @param accounts Array of account data from the blockchain
 * @param cluster The Pyth cluster where the accounts were fetched from
 * @returns Lazer-specific configuration object
 */
export function getConfigFromRawAccounts(
  accounts: any[],
  cluster: PythCluster,
): any {
  // Not implemented yet - minimal placeholder
  return {
    programType: ProgramType.PYTH_LAZER,
    cluster,
    feeds: [],
  };
}

/**
 * Format the configuration for downloading as a JSON file
 *
 * @param config The program's configuration object
 * @returns Configuration formatted for download
 */
export function getDownloadableConfig(config: any): any {
  // For now, just return an empty config
  return {};
}

/**
 * Validate an uploaded configuration against the current configuration
 *
 * @param existingConfig Current configuration
 * @param uploadedConfig Configuration from an uploaded file
 * @param cluster The Pyth cluster the configuration is for
 * @returns Object with validation result and optional error message
 */
export function validateUploadedConfig(
  existingConfig: any,
  uploadedConfig: any,
  cluster: PythCluster,
): ValidationResult {
  // Not implemented yet - return error
  return {
    isValid: false,
    error: "Uploading configuration for Pyth Lazer is not yet supported",
  };
}

/**
 * Generate the necessary instructions to apply configuration changes
 *
 * @param changes Configuration changes to apply
 * @param cluster The Pyth cluster where the changes will be applied
 * @param accounts Additional context needed for generating instructions
 * @returns Promise resolving to an array of TransactionInstructions
 */
export async function generateInstructions(
  changes: Record<
    string,
    {
      prev?: Partial<DownloadableProduct>;
      new?: Partial<DownloadableProduct>;
    }
  >,
  cluster: PythCluster,
  accounts: LazerInstructionAccounts,
): Promise<TransactionInstruction[]> {
  // Not implemented yet - return empty array
  return [];
}
