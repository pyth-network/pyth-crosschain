import { AccountInfo, PublicKey } from "@solana/web3.js";
import { PythCluster } from "@pythnetwork/client";
import {
  DownloadableConfig,
  ProgramType,
  RawConfig,
  LazerConfig,
  ProgramConfig,
  GetConfigParams,
  LazerConfigParams,
  ValidationResult,
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
  [ProgramType.PYTH_CORE]: () => true, // Pyth Core is available on all clusters - using direct value instead of a trivial function
  [ProgramType.PYTH_LAZER]: pythLazer.isAvailableOnCluster,
};

/**
 * Function to get configuration for each program type
 */
export const getConfig: Record<
  ProgramType,
  (params: GetConfigParams) => ProgramConfig
> = {
  [ProgramType.PYTH_CORE]: pythCore.getConfig,
  [ProgramType.PYTH_LAZER]: pythLazer.getConfig,
};

/**
 * Function to format the configuration for downloading as a JSON file
 * Uses type narrowing to determine the correct implementation based on the config shape
 */
export const getDownloadableConfig = (
  config: ProgramConfig,
): DownloadableConfig => {
  if ("mappingAccounts" in config) {
    return pythCore.getDownloadableConfig(config);
  } else if (
    "feeds" in config &&
    config.programType === ProgramType.PYTH_LAZER
  ) {
    return pythLazer.getDownloadableConfig(config);
  }
  throw new Error(
    "Invalid config type - could not determine program type from config structure",
  );
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
  [ProgramType.PYTH_CORE]: pythCore.generateInstructions,
  [ProgramType.PYTH_LAZER]: pythLazer.generateInstructions,
};
