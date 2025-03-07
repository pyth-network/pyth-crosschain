use {
    crate::{api::ChainId, config::ConfigOptions},
    clap::Args,
    ethers::types::Address,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Request Price Update Options")]
#[group(id = "RequestPriceUpdate")]
pub struct RequestPriceUpdateOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// Request price updates on this blockchain.
    #[arg(long = "chain-id")]
    #[arg(env = "ARGUS_CHAIN_ID")]
    pub chain_id: ChainId,

    /// A 20-byte (40 char) hex encoded Ethereum private key.
    /// This key is required to submit transactions (such as registering with the contract).
    #[arg(long = "private-key")]
    #[arg(env = "PRIVATE_KEY")]
    pub private_key: String,

    /// Submit a price update request to this provider
    #[arg(long = "provider")]
    #[arg(env = "ARGUS_PROVIDER")]
    pub provider: Address,

    /// Price IDs to update (comma-separated hex strings, e.g. "0x1234...5678,0xabcd...ef01")
    #[arg(long = "price-ids")]
    #[arg(env = "ARGUS_PRICE_IDS")]
    #[arg(required = true)]
    pub price_ids: String,

    /// Callback gas limit for the price update request
    #[arg(long = "callback-gas-limit")]
    #[arg(env = "ARGUS_CALLBACK_GAS_LIMIT")]
    #[arg(default_value = "500000")]
    pub callback_gas_limit: u64,
}
