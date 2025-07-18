use std::time::Duration;

use backoff::{
    default::{INITIAL_INTERVAL_MILLIS, MAX_INTERVAL_MILLIS, MULTIPLIER, RANDOMIZATION_FACTOR},
    ExponentialBackoff, ExponentialBackoffBuilder,
};

#[derive(Debug)]
pub struct PythLazerExponentialBackoffBuilder {
    initial_interval: Duration,
    randomization_factor: f64,
    multiplier: f64,
    max_interval: Duration,
}

impl Default for PythLazerExponentialBackoffBuilder {
    fn default() -> Self {
        Self {
            initial_interval: Duration::from_millis(INITIAL_INTERVAL_MILLIS),
            randomization_factor: RANDOMIZATION_FACTOR,
            multiplier: MULTIPLIER,
            max_interval: Duration::from_millis(MAX_INTERVAL_MILLIS),
        }
    }
}

impl PythLazerExponentialBackoffBuilder {
    pub fn new() -> Self {
        Default::default()
    }

    /// The initial retry interval.
    pub fn with_initial_interval(&mut self, initial_interval: Duration) -> &mut Self {
        self.initial_interval = initial_interval;
        self
    }

    /// The randomization factor to use for creating a range around the retry interval.
    ///
    /// A randomization factor of 0.5 results in a random period ranging between 50% below and 50%
    /// above the retry interval.
    pub fn with_randomization_factor(&mut self, randomization_factor: f64) -> &mut Self {
        self.randomization_factor = randomization_factor;
        self
    }

    /// The value to multiply the current interval with for each retry attempt.
    pub fn with_multiplier(&mut self, multiplier: f64) -> &mut Self {
        self.multiplier = multiplier;
        self
    }

    /// The maximum value of the back off period. Once the retry interval reaches this
    /// value it stops increasing.
    pub fn with_max_interval(&mut self, max_interval: Duration) -> &mut Self {
        self.max_interval = max_interval;
        self
    }

    pub fn build(&self) -> ExponentialBackoff {
        ExponentialBackoffBuilder::default()
            .with_initial_interval(self.initial_interval)
            .with_randomization_factor(self.randomization_factor)
            .with_multiplier(self.multiplier)
            .with_max_interval(self.max_interval)
            .with_max_elapsed_time(None)
            .build()
    }
}
