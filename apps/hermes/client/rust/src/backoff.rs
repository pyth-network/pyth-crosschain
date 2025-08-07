//! Exponential backoff implementation for Pyth Lazer client.
//!
//! This module provides a wrapper around the [`backoff`] crate's exponential backoff functionality,
//! offering a simplified interface tailored for Pyth Lazer client operations.

use std::time::Duration;

use backoff::{
    default::{INITIAL_INTERVAL_MILLIS, MAX_INTERVAL_MILLIS, MULTIPLIER, RANDOMIZATION_FACTOR},
    ExponentialBackoff, ExponentialBackoffBuilder,
};

/// A wrapper around the backoff crate's exponential backoff configuration.
///
/// This struct encapsulates the parameters needed to configure exponential backoff
/// behavior and can be converted into the backoff crate's [`ExponentialBackoff`] type.
#[derive(Debug)]
pub struct HermesExponentialBackoff {
    /// The initial retry interval.
    initial_interval: Duration,
    /// The randomization factor to use for creating a range around the retry interval.
    ///
    /// A randomization factor of 0.5 results in a random period ranging between 50% below and 50%
    /// above the retry interval.
    randomization_factor: f64,
    /// The value to multiply the current interval with for each retry attempt.
    multiplier: f64,
    /// The maximum value of the back off period. Once the retry interval reaches this
    /// value it stops increasing.
    max_interval: Duration,
}

impl From<HermesExponentialBackoff> for ExponentialBackoff {
    fn from(val: HermesExponentialBackoff) -> Self {
        ExponentialBackoffBuilder::default()
            .with_initial_interval(val.initial_interval)
            .with_randomization_factor(val.randomization_factor)
            .with_multiplier(val.multiplier)
            .with_max_interval(val.max_interval)
            .with_max_elapsed_time(None)
            .build()
    }
}

/// Builder for [`PythLazerExponentialBackoff`].
///
/// Provides a fluent interface for configuring exponential backoff parameters
/// with sensible defaults from the backoff crate.
#[derive(Debug)]
pub struct HermesExponentialBackoffBuilder {
    initial_interval: Duration,
    randomization_factor: f64,
    multiplier: f64,
    max_interval: Duration,
}

impl Default for HermesExponentialBackoffBuilder {
    fn default() -> Self {
        Self {
            initial_interval: Duration::from_millis(INITIAL_INTERVAL_MILLIS),
            randomization_factor: RANDOMIZATION_FACTOR,
            multiplier: MULTIPLIER,
            max_interval: Duration::from_millis(MAX_INTERVAL_MILLIS),
        }
    }
}

impl HermesExponentialBackoffBuilder {
    /// Creates a new builder with default values.
    pub fn new() -> Self {
        Default::default()
    }

    /// Sets the initial retry interval.
    ///
    /// This is the starting interval for the first retry attempt.
    pub fn with_initial_interval(&mut self, initial_interval: Duration) -> &mut Self {
        self.initial_interval = initial_interval;
        self
    }

    /// Sets the randomization factor to use for creating a range around the retry interval.
    ///
    /// A randomization factor of 0.5 results in a random period ranging between 50% below and 50%
    /// above the retry interval. This helps avoid the "thundering herd" problem when multiple
    /// clients retry at the same time.
    pub fn with_randomization_factor(&mut self, randomization_factor: f64) -> &mut Self {
        self.randomization_factor = randomization_factor;
        self
    }

    /// Sets the value to multiply the current interval with for each retry attempt.
    ///
    /// A multiplier of 2.0 means each retry interval will be double the previous one.
    pub fn with_multiplier(&mut self, multiplier: f64) -> &mut Self {
        self.multiplier = multiplier;
        self
    }

    /// Sets the maximum value of the back off period.
    ///
    /// Once the retry interval reaches this value it stops increasing, providing
    /// an upper bound on the wait time between retries.
    pub fn with_max_interval(&mut self, max_interval: Duration) -> &mut Self {
        self.max_interval = max_interval;
        self
    }

    /// Builds the [`PythLazerExponentialBackoff`] configuration.
    pub fn build(&self) -> HermesExponentialBackoff {
        HermesExponentialBackoff {
            initial_interval: self.initial_interval,
            randomization_factor: self.randomization_factor,
            multiplier: self.multiplier,
            max_interval: self.max_interval,
        }
    }
}
