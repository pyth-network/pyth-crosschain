import { PublicKey } from "@solana/web3.js";
import { PermissionData, Product } from "@pythnetwork/client";
import { LazerInstructionAccounts } from "./lazer/lazer_functions";
import { CoreInstructionAccounts } from "./core/core_functions";
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
 * Can be either a mapping of symbols to products (Core) or a LazerState (Lazer)
 */
export type DownloadableConfig =
  | Record<string, DownloadableProduct>
  | LazerState;

/**
 * Type for configuration that can be either RawConfig for Pyth Core or LazerConfig for Lazer
 */
export type ProgramConfig = RawConfig | LazerConfig;

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

/**
 * Lazer feed metadata type
 */
export type LazerFeedMetadata = {
  priceFeedId: number;
  name: string;
  symbol: string;
  description: string;
  assetType: string;
  exponent: number;
  minPublishers: number;
  minRate: string;
  expiryTime: string;
  isActivated: boolean;
  hermesId?: string;
  cmcId?: number;
  fundingRateInterval?: string;
  quoteCurrency?: string;
  marketSchedule: string;
};

/**
 * Lazer feed type
 */
export type LazerFeed = {
  metadata: LazerFeedMetadata;
  pendingActivation?: string;
};

/**
 * Lazer publisher type
 */
export type LazerPublisher = {
  publisherId: number;
  name: string;
  publicKeys: string[];
  isActive: boolean;
};

/**
 * Full Lazer state type
 */
export type LazerState = {
  shardId: number;
  lastSequenceNo: string;
  lastTimestamp: string;
  shardName: string;
  minRate: string;
  feeds: LazerFeed[];
  publishers: LazerPublisher[];
};

/**
 * Lazer-specific configuration type
 */
export type LazerConfig = {
  programType: ProgramType.PYTH_LAZER;
  // The Lazer state data
  state: LazerState;
};
