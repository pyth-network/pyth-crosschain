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

    /// Only send the withdrawal transaction if the accrued fees are larger than this amount.
    #[arg(long = "threshold")]
    #[arg(default_value = "0.02")]
    pub threshold: String,

    /// Rebalance any ETH in the provider wallet over this quantity to the keeper wallet.
    /// If not provided, all claimed fees will stay in the provider wallet.
    #[arg(long = "rebalance")]
    #[arg(default_value = "None")]
    pub rebalance: Option<String>,
}
