use clap::Args;
use crate::config::{EthereumOptions, RandomnessOptions};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Register Provider Options")]
#[group(id = "RegisterProvider")]
pub struct RegisterProviderOptions {
    #[command(flatten)]
    pub ethereum: EthereumOptions,

    #[command(flatten)]
    pub randomness: RandomnessOptions,

    /// The fee to charge (in wei) for each requested random number
    #[arg(long = "pyth-contract-fee")]
    #[arg(default_value = "100")]
    pub fee: u64,
}
