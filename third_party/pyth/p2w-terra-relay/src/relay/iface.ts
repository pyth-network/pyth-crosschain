// This module describes a common interface in front of chain-specific
// relay logic.

export type PriceId = string;

/// Describes the possible outcomes of a relay() call on target chain
/// NOTE(2022-03-21): order reflects the historically used constants
export enum RelayRetcode {
  Success = 0,
  Fail, // Generic failure
  AlreadyExecuted, // TODO(2022-03-18): Terra-specific leak, remove ASAP
  Timeout, // Our desired timeout expired
  SeqNumMismatch, // TODO(2022-03-18): Terra-specific leak, remove ASAP
  InsufficientFunds, // Payer's too poor
}

/// relay() return type
export class RelayResult {
  code: RelayRetcode;
  txHashes: Array<string>; /// One or more tx hashes produced by a successful relay() call

  constructor(code: RelayRetcode, hashes: Array<string>) {
    this.code = code;
    this.txHashes = hashes;
  }

  is_ok(): boolean {
    return this.code == RelayRetcode.Success;
  }
}

/// Represents a target chain relay client generically.
export interface Relay {
  /// Relay a signed Wormhole payload to this chain
  relay(signedVAAs: Array<string>): Promise<RelayResult>;

  /// Query price data on this chain
  query(priceId: PriceId): Promise<any>;

  /// Monitor the payer account balance
  getPayerInfo(): Promise<{ address: string; balance: number }>;
}
