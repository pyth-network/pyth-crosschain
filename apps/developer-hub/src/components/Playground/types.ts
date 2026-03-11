/**
 * Shared types for the Pyth Pro Playground components
 */

// Chain/format options for signed payloads
export type ChainFormat = "evm" | "solana" | "leEcdsa" | "leUnsigned";

// Delivery format for the response
export type DeliveryFormat = "json" | "binary";

// JSON binary encoding format
export type JsonBinaryEncoding = "base64" | "hex";

// Price feed properties that can be requested
export type PriceFeedProperty =
  | "price"
  | "bestBidPrice"
  | "bestAskPrice"
  | "exponent"
  | "publisherCount"
  | "confidence"
  | "fundingRate"
  | "fundingTimestamp"
  | "fundingRateInterval"
  | "marketSession"
  | "feedUpdateTimestamp";

// Update channel options
export type Channel = "real_time" | "fixed_rate@50ms" | "fixed_rate@200ms";

// Price feed data from the symbols API
export type PriceFeed = {
  pythLazerId: number;
  name: string;
  symbol: string;
  description: string;
  assetType: string;
  exponent: number;
};

// Main configuration state for the playground
export type PlaygroundConfig = {
  accessToken: string;
  priceFeedIds: number[];
  properties: PriceFeedProperty[];
  formats: ChainFormat[];
  channel: Channel;
  deliveryFormat: DeliveryFormat;
  jsonBinaryEncoding: JsonBinaryEncoding;
  parsed: boolean;
};

// Default configuration values
export const DEFAULT_CONFIG: PlaygroundConfig = {
  accessToken: "", // Empty means use demo token
  channel: "fixed_rate@200ms",
  deliveryFormat: "json",
  formats: ["solana"],
  jsonBinaryEncoding: "hex",
  parsed: true,
  priceFeedIds: [1, 2], // BTC/USD and ETH/USD
  properties: ["price"],
};

// Available options for selectors
export const PROPERTY_OPTIONS: {
  id: PriceFeedProperty;
  label: string;
  description: string;
}[] = [
  { description: "Aggregate market price", id: "price", label: "Price" },
  { description: "Highest bid price", id: "bestBidPrice", label: "Best Bid" },
  { description: "Lowest ask price", id: "bestAskPrice", label: "Best Ask" },
  {
    description: "Price confidence interval",
    id: "confidence",
    label: "Confidence",
  },
  { description: "Decimal exponent", id: "exponent", label: "Exponent" },
  {
    description: "Number of publishers",
    id: "publisherCount",
    label: "Publisher Count",
  },
  {
    description: "Perpetual futures funding rate",
    id: "fundingRate",
    label: "Funding Rate",
  },
  {
    description: "Last funding calculation time",
    id: "fundingTimestamp",
    label: "Funding Timestamp",
  },
  {
    description: "Duration between funding updates",
    id: "fundingRateInterval",
    label: "Funding Interval",
  },
  {
    description: "Market session enum (e.g., regular, pre/post)",
    id: "marketSession",
    label: "Market Session",
  },
  {
    description: "Timestamp when price was last generated for this feed",
    id: "feedUpdateTimestamp",
    label: "Feed Update Timestamp",
  },
];

export const CHAIN_OPTIONS: {
  id: ChainFormat;
  label: string;
  description: string;
}[] = [
  { description: "Ed25519 EdDSA signature", id: "solana", label: "Solana" },
  { description: "secp256k1 ECDSA signature", id: "evm", label: "EVM" },
  { description: "Little-endian secp256k1", id: "leEcdsa", label: "LE ECDSA" },
  {
    description: "Raw payload without signature",
    id: "leUnsigned",
    label: "Unsigned",
  },
];

export const CHANNEL_OPTIONS: {
  id: Channel;
  label: string;
  description: string;
}[] = [
  {
    description: "Updates as fast as possible (1-50ms)",
    id: "real_time",
    label: "Real Time",
  },
  {
    description: "Updates every 50 milliseconds",
    id: "fixed_rate@50ms",
    label: "Fixed 50ms",
  },
  {
    description: "Updates every 200 milliseconds",
    id: "fixed_rate@200ms",
    label: "Fixed 200ms",
  },
];

// Code language options for the code preview
export type CodeLanguage = "typescript" | "cli" | "go" | "python";

export const CODE_LANGUAGE_OPTIONS: { id: CodeLanguage; label: string }[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "cli", label: "CLI" },
  { id: "go", label: "Go" },
  { id: "python", label: "Python" },
];

// Execution state for the output console
export type ExecutionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

export type ExecutionState = {
  status: ExecutionStatus;
  messages: StreamMessage[];
  error?: string;
};

export type StreamMessage = {
  id: string;
  timestamp: Date;
  type: "info" | "data" | "error";
  content: string;
};

// WebSocket endpoints
export const PYTH_PRO_ENDPOINTS = [
  "wss://pyth-lazer-0.dourolabs.app/v1/stream",
  "wss://pyth-lazer-1.dourolabs.app/v1/stream",
  "wss://pyth-lazer-2.dourolabs.app/v1/stream",
];

// API endpoint for symbols
export const SYMBOLS_API_URL =
  "https://history.pyth-lazer.dourolabs.app/history/v1/symbols";
