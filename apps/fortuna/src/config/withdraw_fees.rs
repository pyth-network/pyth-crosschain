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

    /// Run the withdrawal task in "cron" mode, such that it can be repeated on a schedule.
    /// This flag doesn't claim fees under a certain quantity (to save gas) and also rebalances
    /// fees above a configure threshold into the keeper wallet.
    #[arg(long = "cron")]
    #[arg(default_value = "false")]
    pub cron: bool,
}
