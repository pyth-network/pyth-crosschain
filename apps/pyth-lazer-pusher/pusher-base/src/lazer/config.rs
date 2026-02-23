//! Configuration for Pyth Lazer connections.

use derivative::Derivative;
use serde::Deserialize;
use std::time::Duration;
use url::Url;

/// Configuration for connecting to Pyth Lazer router.
#[derive(Derivative, Clone, Deserialize)]
#[derivative(Debug)]
pub struct LazerConfig {
    /// Router WebSocket endpoints
    pub endpoints: Vec<Url>,

    /// Access token for authentication
    #[derivative(Debug = "ignore")]
    pub access_token: String,

    /// Number of WebSocket connections to maintain
    #[serde(default = "default_num_connections")]
    pub num_connections: usize,

    /// Connection timeout
    #[serde(with = "humantime_serde", default = "default_timeout")]
    pub timeout: Duration,
}

fn default_num_connections() -> usize {
    2
}

fn default_timeout() -> Duration {
    Duration::from_secs(5)
}
