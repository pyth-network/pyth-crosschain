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

    // FIXME: I think this has to be the pubkey of the private key in the ethereum options
    /// Submit a randomness request to this provider
    #[arg(long = "provider")]
    #[arg(env = "PYTH_PROVIDER")]
    #[arg(default_value = "0x368397bDc956b4F23847bE244f350Bde4615F25E")]
    pub provider: String,
}
