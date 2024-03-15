/// The state of the randomness service for a single blockchain.
#[derive(Clone)]
pub struct BlockchainState {
    /// The hash chain(s) required to serve random numbers for this blockchain
    pub state:                  Arc<HashChainState>,
    /// The contract that the server is fulfilling requests for.
    pub contract:               Arc<dyn EntropyReader>,
    /// The address of the provider that this server is operating for.
    pub provider_address:       Address,
    /// The server will wait for this many block confirmations of a request before revealing
    /// the random number.
    pub reveal_delay_blocks:    BlockNumber,
    /// The BlockStatus of the block that is considered to be confirmed on the blockchain.
    /// For eg., Finalized, Safe
    pub confirmed_block_status: BlockStatus,
    /// TODO: add private key
}
