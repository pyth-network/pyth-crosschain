use {clap::Args, humantime::Duration};

#[derive(Args, Clone, Debug)]
#[command(next_help_heading = "Aggregate Options")]
#[group(id = "Aggregate")]
pub struct Options {
    /// The duration of no aggregation after which the readiness of the state is considered stale.
    #[arg(long = "aggregate-readiness-staleness-threshold")]
    #[arg(env = "AGGREGATE_READINESS_STALENESS_THRESHOLD")]
    #[arg(default_value = "30s")]
    pub readiness_staleness_threshold: Duration,

    /// The maximum allowed slot lag between the latest observed slot and the latest completed slot.
    #[arg(long = "aggregate-readiness-max-allowed-slot-lag")]
    #[arg(env = "AGGREGATE_READINESS_MAX_ALLOWED_SLOT_LAG")]
    #[arg(default_value = "10")]
    pub readiness_max_allowed_slot_lag: u64,
}
