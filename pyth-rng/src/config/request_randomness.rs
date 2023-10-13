use clap::Args;

use crate::config::{EthereumOptions, RandomnessOptions};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Request Randomness Options")]
#[group(id = "RequestRandomness")]
pub struct RequestRandomnessOptions {
    #[command(flatten)]
    pub ethereum: EthereumOptions,

    #[command(flatten)]
    pub randomness: RandomnessOptions,
}
