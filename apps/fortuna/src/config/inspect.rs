use {
    crate::{
        api::ChainId,
        config::ConfigOptions,
    },
    clap::Args,
};


#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Inspect Options")]
#[group(id = "Inspect")]
pub struct InspectOptions {
    #[command(flatten)]
    pub config: ConfigOptions,

    /// Check the requests on this chain, or all chains if not specified.
    #[arg(long = "chain-id")]
    #[arg(env = "FORTUNA_CHAIN_ID")]
    pub chain_id: Option<ChainId>,

    /// The number of requests to inspect starting from the most recent request.
    /// Default: 1000
    #[arg(long = "num-requests", default_value = "1000")]
    pub num_requests: u64,
}
