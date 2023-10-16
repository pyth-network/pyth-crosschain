use clap::Args;

use crate::config::{EthereumOptions, RandomnessOptions};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Generate Options")]
#[group(id = "Generate")]
pub struct GenerateOptions {
    #[command(flatten)]
    pub ethereum: EthereumOptions,

    /// Submit a randomness request to this provider
    #[arg(long = "provider")]
    #[arg(env = "PYTH_PROVIDER")]
    #[arg(default_value = "0x368397bDc956b4F23847bE244f350Bde4615F25E")]
    pub provider: String,

    pub
}
