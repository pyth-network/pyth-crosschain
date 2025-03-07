use {
    crate::{api::ChainId, config::ConfigOptions},
    clap::Args,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Register Provider Options")]
#[group(id = "RegisterProvider")]
pub struct RegisterProviderOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// Register the provider on this chain
    #[arg(long = "chain-id")]
    #[arg(env = "FORTUNA_CHAIN_ID")]
    pub chain_id: ChainId,
}
