//! Base configuration shared by all pushers.

use crate::lazer::{FeedsConfig, LazerConfig};
use serde::Deserialize;
use std::net::SocketAddr;

/// Base configuration shared by all price pushers.
///
/// Specific pushers should flatten this into their config:
/// ```ignore
/// #[derive(Deserialize)]
/// pub struct Config {
///     #[serde(flatten)]
///     pub base: BaseConfig,
///     pub my_pusher_specific: MyConfig,
/// }
/// ```
#[derive(Debug, Clone, Deserialize)]
pub struct BaseConfig {
    /// Prometheus metrics address
    pub prometheus_address: SocketAddr,

    /// Pyth Lazer configuration (source of price feeds)
    pub lazer: LazerConfig,

    /// Feed subscription configuration
    pub feeds: FeedsConfig,
}
