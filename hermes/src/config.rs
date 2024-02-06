use clap::{
    crate_authors,
    crate_description,
    crate_name,
    crate_version,
    Args,
    Parser,
};

mod benchmarks;
mod metrics;
mod pyth_addresses;
mod pythnet;
mod rpc;
mod wormhole;

// `Options` is a structup definition to provide clean command-line args for Hermes.
#[derive(Parser, Debug)]
#[command(name = crate_name!())]
#[command(author = crate_authors!())]
#[command(about = crate_description!())]
#[command(version = crate_version!())]
#[allow(clippy::large_enum_variant)]
pub enum Options {
    /// Run the Hermes Price Service.
    Run(RunOptions),

    /// Show Overridden Environment Variables.
    ShowEnv(ShowEnvOptions),
}

#[derive(Args, Clone, Debug)]
pub struct RunOptions {
    /// Wormhole Options.
    #[command(flatten)]
    pub wormhole: wormhole::Options,

    /// PythNet Options
    #[command(flatten)]
    pub pythnet: pythnet::Options,

    /// RPC Options
    #[command(flatten)]
    pub rpc: rpc::Options,

    /// Benchmarks Options
    #[command(flatten)]
    pub benchmarks: benchmarks::Options,

    /// Metrics Options
    #[command(flatten)]
    pub metrics: metrics::Options,

    /// Mapping Address Options
    #[command(flatten)]
    pub pyth_addresses: pyth_addresses::Options,

    /// Update interval for price_feeds_cache in seconds. Default is 600 seconds.
    #[arg(long = "price-feeds-cache-update-interval", default_value_t = 60)]
    pub price_feeds_cache_update_interval: u64,
}

#[derive(Args, Clone, Debug)]
pub struct ShowEnvOptions {
    /// Show Hermes environment variables.
    ///
    /// By default this command will attempt to read the variable from the environment and fall
    /// back to the argument default if not present. Set this flag if you want only the defaults
    /// and to ignore the current environment.
    #[arg(long = "defaults")]
    pub defaults: bool,
}
