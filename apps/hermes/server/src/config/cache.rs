use clap::Args;

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Cache Options")]
#[group(id = "Cache")]
pub struct Options {
    /// The maximum number of slots to cache.
    ///
    /// This controls how many historical price updates are kept in memory.
    /// Higher values increase memory usage but allow access to more historical data
    /// without falling back to Benchmarks.
    ///
    /// Default is 1600 slots, which gives 640 seconds of cached updates.
    #[arg(long = "cache-size-slots")]
    #[arg(env = "CACHE_SIZE_SLOTS")]
    #[arg(default_value = "1600")]
    pub size_slots: usize,
}
