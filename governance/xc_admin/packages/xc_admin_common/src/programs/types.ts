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

export type CoreConfigParams = {
  accounts: Array<{ pubkey: PublicKey; account: AccountInfo<Buffer> }>;
  cluster: PythCluster;
};

/**
 * Lazer-specific configuration type
 * TODO: Change to actual Lazer config type
 */
export type LazerConfig = {
  programType: ProgramType.PYTH_LAZER;
  // Make cluster optional since Lazer might not be tied to a specific cluster
  cluster?: PythCluster;
  // More generic data source instead of Solana-specific accounts
  feeds: LazerFeed[];
  // Additional metadata that might be relevant for Lazer
  metadata?: Record<string, unknown>;
};

/**
 * Parameters for getting Lazer configuration
 */
export type LazerConfigParams = {
  // Instead of requiring Solana accounts, allow any parameters needed
  endpoint?: string;
  network?: string;
  options?: Record<string, unknown>;
};

/**
 * Union type for configuration parameters that can vary by program type
 */
export type GetConfigParams =
  | ({
      programType: ProgramType.PYTH_CORE;
    } & CoreConfigParams)
  | ({ programType: ProgramType.PYTH_LAZER } & LazerConfigParams);

/**
 * Lazer feed configuration
 * TODO: Change to actual Lazer feed type
 */
export type LazerFeed = {
  id: string;
  metadata: Record<string, string | number | boolean>;
  // Add other feed-specific properties as needed
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
export type DownloadableConfig = Record<string, DownloadableProduct>;

/**
 * Type for configuration that can be either RawConfig for Pyth Core or LazerConfig for Lazer
 */
export type ProgramConfig = RawConfig | LazerConfig;

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
  // Lazer-specific properties
  lazerProgramClient?: any; // Replace with proper type when available
  cluster: PythCluster;
  additionalAccounts?: Record<string, PublicKey>;
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
 * Result of validating an uploaded configuration
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  changes?: any;
}
