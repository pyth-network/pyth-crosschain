use clap::{crate_authors, crate_description, crate_name, crate_version, Args, Parser};

mod aggregate;
mod benchmarks;
mod cache;
mod metrics;
mod pythnet;
mod rpc;
mod wormhole;

// `Options` is a structup definition to provide clean command-line args for Hermes.
#[derive(Parser, Debug)]
#[command(name = crate_name!())]
#[command(author = crate_authors!())]
#[command(about = crate_description!())]
#[command(version = crate_version!())]
#[allow(
    clippy::large_enum_variant,
    reason = "performance is not a concern for config"
)]
pub enum Options {
    /// Run the Hermes Price Service.
    Run(RunOptions),

    /// Show Overridden Environment Variables.
    ShowEnv(ShowEnvOptions),
}

#[derive(Args, Clone, Debug)]
pub struct RunOptions {
    /// Cache Options
    #[command(flatten)]
    pub cache: cache::Options,

    /// Aggregate Options
    #[command(flatten)]
    pub aggregate: aggregate::Options,

    /// Benchmarks Options
    #[command(flatten)]
    pub benchmarks: benchmarks::Options,

    /// Metrics Options
    #[command(flatten)]
    pub metrics: metrics::Options,

    /// PythNet Options
    #[command(flatten)]
    pub pythnet: pythnet::Options,

    /// RPC Options
    #[command(flatten)]
    pub rpc: rpc::Options,

    /// Wormhole Options.
    #[command(flatten)]
    pub wormhole: wormhole::Options,
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
