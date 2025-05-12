import { AccountInfo, PublicKey } from "@solana/web3.js";
import { PythCluster } from "@pythnetwork/client";
import { DownloadableConfig, ProgramType, RawConfig } from "./types";
import {
  ProgramFunctions,
  ValidationResult,
  GenerateInstructionsFn,
} from "./types";

// Import functions from each program implementation
import * as pythCore from "./core/core_functions";
import * as pythLazer from "./lazer/lazer_functions";

/**
 * Function to get the program address for each program type
 */
export const getProgramAddress: Record<
  ProgramType,
  (cluster: PythCluster) => PublicKey
> = {
  [ProgramType.PYTH_CORE]: pythCore.getProgramAddress,
  [ProgramType.PYTH_LAZER]: pythLazer.getProgramAddress,
};

/**
 * Function to check if a program is available on a specific cluster
 */
export const isAvailableOnCluster: Record<
  ProgramType,
  (cluster: PythCluster) => boolean
> = {
  [ProgramType.PYTH_CORE]: pythCore.isAvailableOnCluster,
  [ProgramType.PYTH_LAZER]: pythLazer.isAvailableOnCluster,
};

/**
 * Function to parse raw on-chain accounts into a configuration object
 */
export const getConfigFromRawAccounts: Record<
  ProgramType,
  (
    accounts: Array<{ pubkey: PublicKey; account: AccountInfo<Buffer> }>,
    cluster: PythCluster,
  ) => RawConfig
> = {
  [ProgramType.PYTH_CORE]: pythCore.getConfigFromRawAccounts,
  [ProgramType.PYTH_LAZER]: pythLazer.getConfigFromRawAccounts,
};

/**
 * Function to format the configuration for downloading as a JSON file
 */
export const getDownloadableConfig: Record<
  ProgramType,
  (config: RawConfig) => DownloadableConfig
> = {
  [ProgramType.PYTH_CORE]: pythCore.getDownloadableConfig,
  [ProgramType.PYTH_LAZER]: pythLazer.getDownloadableConfig,
};

/**
 * Function to validate an uploaded configuration against the current configuration
 */
export const validateUploadedConfig: Record<
  ProgramType,
  (
    existingConfig: DownloadableConfig,
    uploadedConfig: unknown,
    cluster: PythCluster,
  ) => ValidationResult
> = {
  [ProgramType.PYTH_CORE]: pythCore.validateUploadedConfig,
  [ProgramType.PYTH_LAZER]: pythLazer.validateUploadedConfig,
};

/**
 * Function to generate the necessary instructions to apply configuration changes
 */
export const generateInstructions = {
  [ProgramType.PYTH_CORE]:
    pythCore.generateInstructions as GenerateInstructionsFn<ProgramType.PYTH_CORE>,
  [ProgramType.PYTH_LAZER]:
    pythLazer.generateInstructions as GenerateInstructionsFn<ProgramType.PYTH_LAZER>,
};

/**
 * Get the complete set of functions for a specific program type
 *
 * @param type The program type to get functions for
 * @returns All functions for the specified program type
 */
export function getProgramFunctions<T extends ProgramType>(
  type: T,
): ProgramFunctions<T> {
  return {
    getProgramAddress: getProgramAddress[type],
    isAvailableOnCluster: isAvailableOnCluster[type],
    getConfigFromRawAccounts: getConfigFromRawAccounts[type],
    getDownloadableConfig: getDownloadableConfig[type],
    validateUploadedConfig: validateUploadedConfig[type],
    generateInstructions: generateInstructions[
      type
    ] as GenerateInstructionsFn<T>,
  };
}
