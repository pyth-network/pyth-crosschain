// This module describes a common interface in front of chain-specific
// relay logic.

/// Represents a target chain client config.
export interface RelayConfig {
    /// Helps pick an appropriate relay() call frequency. usually in
    /// the neighbourhood of the chain's block time
    relayIntervalMs: number;
    /// Helps establish target chain's expected relay() error allowance
    retryCount: number;
    /// How long to wait on a relay() call before it's finalized on target chain
    confirmationTimeoutMs: number;
}

/// Represents a target chain relay client generically.
export interface Relay<RelayConfig> {

    /// Relay a signed Wormhole payload to this chain
    relay(payload: string): Promise<any>;

    /// Query price data on this chain
    query(priceId: string): Promise<any>;

    /// Monitor the payer account balance
    getPayerInfo(): Promise<{address: string, balance: string}>;
}


// Example implementation

class ChACfg implements RelayConfig {
    relayIntervalMs: number = Number(process.env.CHAIN_A_BLOCK_TIME_MS) || 15;
    retryCount: number = Number(process.env.CHAIN_A_RETRY_COUNT) || 5;
    confirmationTimeoutMs: number = 10000;
}

class ChainA implements Relay<ChACfg> {
    readonly config: ChACfg;
    async relay(payload: string) {
	return (async () => {}) ();
    }
    async query(priceId: string) {
    }

    async getPayerInfo() {
	return {
	    address: "AliceThePayer",
	    balance: "BasicallyAFortune",
	}
    }

    constructor(c: ChACfg) {
	this.config = c;
    }
}
