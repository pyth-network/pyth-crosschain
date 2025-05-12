import {
  AccountInfo,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { PermissionData, Product, PythCluster } from "@pythnetwork/client";
import { Connection } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { PythOracle } from "@pythnetwork/client/lib/anchor";
import { MessageBuffer } from "message_buffer/idl/message_buffer";
/**
 * Represents the different Pyth programs supported by the application.
 */
export enum ProgramType {
  /**
   * Original Pyth oracle program
   */
  PYTH_CORE,

  /**
   * Next-generation Pyth oracle program
   */
  PYTH_LAZER,
}

/**
 * Human-readable names for program types
 */
export const PROGRAM_TYPE_NAMES: Record<ProgramType, string> = {
  [ProgramType.PYTH_CORE]: "Pyth Core",
  [ProgramType.PYTH_LAZER]: "Pyth Lazer",
};

/**
 * Type for raw price configs
 */
export type PriceRawConfig = {
  next: PublicKey | null;
  address: PublicKey;
  expo: number;
  minPub: number;
  maxLatency: number;
  publishers: PublicKey[];
};

/**
 * Type for raw product configs
 */
export type ProductRawConfig = {
  address: PublicKey;
  priceAccounts: PriceRawConfig[];
  metadata: Product;
};

/**
 * Type for raw mapping configs
 */
export type MappingRawConfig = {
  address: PublicKey;
  next: PublicKey | null;
  products: ProductRawConfig[];
};

/**
 * Overall raw configuration type
 */
export type RawConfig = {
  mappingAccounts: MappingRawConfig[];
  permissionAccount?: PermissionData;
};

/**
 * Type for downloadable price account configuration
 */
export type DownloadablePriceAccount = {
  address: string;
  publishers: string[];
  expo: number;
  minPub: number;
  maxLatency: number;
};

/**
 * Type for downloadable product configuration
 */
export type DownloadableProduct = {
  address: string;
  metadata: Omit<Product, "price_account">;
  priceAccounts: DownloadablePriceAccount[];
};

/**
 * Type for downloadable configuration
 */
export type DownloadableConfig = {
  [symbol: string]: DownloadableProduct;
};

/**
 * Core program instruction accounts needed for generateInstructions
 */
export interface CoreInstructionAccounts {
  fundingAccount: PublicKey;
  pythProgramClient: Program<PythOracle>;
  messageBufferClient?: Program<MessageBuffer>;
  connection?: Connection;
  rawConfig: RawConfig;
}

/**
 * Lazer program instruction accounts needed for generateInstructions
 */
export interface LazerInstructionAccounts {
  fundingAccount: PublicKey;
  // TODO: Add Lazer-specific account requirements here
  [key: string]: any;
}

/**
 * Union type for program instruction accounts
 */
export type ProgramInstructionAccounts =
  | CoreInstructionAccounts
  | LazerInstructionAccounts;

/**
 * Type mapping to select the appropriate instruction accounts type based on program type
 */
export type InstructionAccountsTypeMap = {
  [ProgramType.PYTH_CORE]: CoreInstructionAccounts;
  [ProgramType.PYTH_LAZER]: LazerInstructionAccounts;
};

/**
 * Function to get the program address for the given cluster and program type
 */
export type GetProgramAddressFn = (cluster: PythCluster) => PublicKey;

/**
 * Function to check if a program is available on a specific cluster
 */
export type IsAvailableOnClusterFn = (cluster: PythCluster) => boolean;

/**
 * Function to parse raw on-chain accounts into a configuration object
 */
export type GetConfigFromRawAccountsFn = (
  accounts: Array<{ pubkey: PublicKey; account: AccountInfo<Buffer> }>,
  cluster: PythCluster,
) => RawConfig;

/**
 * Function to format the configuration for downloading as a JSON file
 */
export type GetDownloadableConfigFn = (config: RawConfig) => DownloadableConfig;

/**
 * Result of validating an uploaded configuration
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  changes?: any;
}

/**
 * Function to validate an uploaded configuration against the current configuration
 */
export type ValidateUploadedConfigFn = (
  existingConfig: DownloadableConfig,
  uploadedConfig: unknown,
  cluster: PythCluster,
) => ValidationResult;

/**
 * Generic type for generate instructions functions for a specific program type
 */
export type GenerateInstructionsFn<T extends ProgramType = ProgramType> = (
  changes: Record<
    string,
    {
      prev?: Partial<DownloadableProduct>;
      new?: Partial<DownloadableProduct>;
    }
  >,
  cluster: PythCluster,
  accounts: InstructionAccountsTypeMap[T],
) => Promise<TransactionInstruction[]>;

/**
 * Collection of functions for each program type
 */
export interface ProgramFunctions<T extends ProgramType = ProgramType> {
  getProgramAddress: GetProgramAddressFn;
  isAvailableOnCluster: IsAvailableOnClusterFn;
  getConfigFromRawAccounts: GetConfigFromRawAccountsFn;
  getDownloadableConfig: GetDownloadableConfigFn;
  validateUploadedConfig: ValidateUploadedConfigFn;
  generateInstructions: GenerateInstructionsFn<T>;
}
