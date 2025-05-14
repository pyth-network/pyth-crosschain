import { AccountInfo, PublicKey } from "@solana/web3.js";
import { getPythProgramKeyForCluster, PythCluster } from "@pythnetwork/client";
import {
  DownloadableConfig,
  ProgramType,
  ProgramConfig,
  ValidationResult,
  RawConfig,
  GetConfigParams,
} from "./types";

// Import functions from each program implementation
import * as pythCore from "./core/core_functions";
import * as pythLazer from "./lazer/lazer_functions";
import { LazerConfig, LAZER_PROGRAM_ID } from "./lazer/lazer_functions";

/**
 * Function to get the program address for each program type
 */
export const getProgramAddress: Record<
  ProgramType,
  (cluster: PythCluster) => PublicKey
> = {
  [ProgramType.PYTH_CORE]: (cluster: PythCluster) =>
    getPythProgramKeyForCluster(cluster),
  [ProgramType.PYTH_LAZER]: () => LAZER_PROGRAM_ID,
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
 * Uses discriminated union to ensure type safety
 */
export const getConfig: {
  [ProgramType.PYTH_CORE]: (
    params: Extract<GetConfigParams, { programType: ProgramType.PYTH_CORE }>,
  ) => RawConfig;
  [ProgramType.PYTH_LAZER]: (
    params: Extract<GetConfigParams, { programType: ProgramType.PYTH_LAZER }>,
  ) => LazerConfig;
} = {
  [ProgramType.PYTH_CORE]: (params) => pythCore.getConfig(params),
  [ProgramType.PYTH_LAZER]: (params) => pythLazer.getConfig(params),
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
    uploadedConfig: DownloadableConfig,
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
