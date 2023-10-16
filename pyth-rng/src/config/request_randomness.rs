use {
    crate::config::{
        EthereumOptions,
        RandomnessOptions,
    },
    clap::Args,
};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Request Randomness Options")]
#[group(id = "RequestRandomness")]
pub struct RequestRandomnessOptions {
    #[command(flatten)]
    pub ethereum: EthereumOptions,

    #[command(flatten)]
    pub randomness: RandomnessOptions,

    /// Submit a randomness request to this provider
    #[arg(long = "provider")]
    #[arg(env = "PYTH_PROVIDER")]
    #[arg(default_value = "0x368397bDc956b4F23847bE244f350Bde4615F25E")]
    pub provider: String,
}
