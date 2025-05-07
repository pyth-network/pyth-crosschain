import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { PythCluster } from "@pythnetwork/client";

/**
 * Program adapter interface that defines the contract for interacting with
 * different Pyth programs (Core, Lazer, etc).
 *
 * This adapter pattern allows the frontend to use a consistent interface
 * while supporting multiple program implementations.
 */
export interface ProgramAdapter {
  /**
   * Program address on Solana
   * Each program may have different addresses on different clusters
   */
  getProgramAddress(cluster: PythCluster): PublicKey;

  /**
   * Human-readable name of the program
   */
  readonly name: string;

  /**
   * Brief description of the program
   */
  readonly description: string;

  /**
   * Type identifier for the program
   */
  readonly type: string;

  /**
   * Parse raw on-chain accounts into a standardized configuration object
   * for the specific program.
   *
   * @param accounts Array of account data from the blockchain
   * @param cluster The Pyth cluster where the accounts were fetched from
   * @returns Program-specific configuration object
   */
  getConfigFromRawAccounts(accounts: any[], cluster: PythCluster): any;

  /**
   * Format the configuration for downloading as a JSON file
   *
   * @param config The program's configuration object
   * @returns Configuration formatted for download
   */
  getDownloadableConfig(config: any): any;

  /**
   * Validate an uploaded configuration against the current configuration
   *
   * @param existingConfig Current configuration
   * @param uploadedConfig Configuration from an uploaded file
   * @returns Object with validation result and optional error message
   */
  validateUploadedConfig(
    existingConfig: any,
    uploadedConfig: any,
    cluster: PythCluster,
  ): {
    isValid: boolean;
    error?: string;
    changes?: any;
  };

  /**
   * Generate the necessary instructions to apply configuration changes
   *
   * @param changes Configuration changes to apply
   * @param cluster The Pyth cluster where the changes will be applied
   * @param accounts Additional context needed for generating instructions
   * @returns Promise resolving to an array of TransactionInstructions
   */
  generateInstructions(
    changes: any,
    cluster: PythCluster,
    accounts: {
      fundingAccount: PublicKey;
      [key: string]: any;
    },
  ): Promise<TransactionInstruction[]>;

  /**
   * Check if the program is available on the specified cluster
   *
   * @param cluster The Pyth cluster to check
   * @returns True if the program is available on the cluster
   */
  isAvailableOnCluster(cluster: PythCluster): boolean;
}
