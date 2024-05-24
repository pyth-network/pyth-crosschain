use {
    crate::{
        api::ChainId,
        config::ConfigOptions,
    },
    clap::Args,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Withdraw Fees Options")]
#[group(id = "Withdraw Fees")]
pub struct WithdrawFeesOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// Withdraw the fees on this chain, or all chains if not specified.
    #[arg(long = "chain-id")]
    pub chain_id: Option<ChainId>,
}
