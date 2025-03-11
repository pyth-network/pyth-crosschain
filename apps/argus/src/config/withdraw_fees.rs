use {
    crate::{api::ChainId, config::ConfigOptions},
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

    /// If provided, run the command using the keeper wallet. By default, the command uses the provider wallet.
    /// If this option is provided, the keeper wallet must be configured and set as the fee manager for the provider.
    #[arg(long = "keeper")]
    #[arg(default_value = "false")]
    pub keeper: bool,

    /// If specified, only withdraw fees over the given balance from the contract.
    /// If omitted, all accrued fees are withdrawn.
    #[arg(long = "retain-balance")]
    #[arg(default_value = "0")]
    pub retain_balance_wei: u128,
}
