// This module describes a common interface in front of chain-specific
// relay logic.

export type PriceId = string;

/// Represents a target chain relay client generically.
export interface Relay {
  /// Relay a signed Wormhole payload to this chain
  relay(signedVAAs: Array<string>): Promise<any>;

  /// Query price data on this chain
  query(priceId: PriceId): Promise<any>;

  /// Monitor the payer account balance
  getPayerInfo(): Promise<{ address: string; balance: number }>;
}
