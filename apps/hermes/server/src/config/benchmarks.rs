use {clap::Args, reqwest::Url};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Benchmark Options")]
#[group(id = "Benchmarks")]
pub struct Options {
    /// Benchmarks endpoint to retrieve historical update data from.
    #[arg(long = "benchmarks-endpoint")]
    #[arg(env = "BENCHMARKS_ENDPOINT")]
    pub endpoint: Option<Url>,
}
