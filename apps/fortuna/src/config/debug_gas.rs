use {
    crate::{api::ChainId, config::ConfigOptions},
    clap::Args,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Debug Gas Options")]
#[group(id = "DebugGas")]
pub struct DebugGasOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// The chain ID to debug gas estimation for.
    #[arg(long = "chain-id")]
    pub chain_id: ChainId,
}
