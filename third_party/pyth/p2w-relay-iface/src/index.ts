/// Represents a target chain client config.
export interface RelayConfig {
    // Helps pick an appropriate relay() call frequency
    blockTimeMs: number;
    // Helps establish target chain's expected relay() error allowance
    retryCount: number;
}

/// Represents a target chain relay client generically.
export interface Relay<RelayConfig> {
    /// Contains all configurable values specific to this target chain
    config: RelayConfig;
    /// Relay a payload to this chain
    relay(payload: string): Promise<any>;
    /// Query a price on this chain
    query(priceId: string): Promise<any>;
}


// Example implementation

class ChACfg implements RelayConfig {
    blockTimeMs: number = Number(process.env.CHAIN_A_BLOCK_TIME_MS) || 15;
    retryCount: number = Number(process.env.CHAIN_A_RETRY_COUNT) || 5;
}

class ChainA implements Relay<ChACfg> {
    config: ChACfg;
    async relay(payload: string): Promise<any> {
	await (async () => {});
    }
    async query(priceId: string): Promise<any> {
    }

    constructor(c: ChACfg) {
	this.config = c;
    }
}
