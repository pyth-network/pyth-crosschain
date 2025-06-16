use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;

use config::{Environment, File};
use derivative::Derivative;
use serde::Deserialize;
use url::Url;

#[derive(Deserialize, Derivative, Clone, PartialEq)]
#[derivative(Debug)]
pub struct Config {
    pub listen_address: SocketAddr,
    pub relayer_urls: Vec<Url>,
    #[derivative(Debug = "ignore")]
    pub publish_keypair_path: PathBuf,
    #[serde(with = "humantime_serde", default = "default_publish_interval")]
    pub publish_interval_duration: Duration,
}

fn default_publish_interval() -> Duration {
    Duration::from_micros(500)
}

pub fn load_config(config_path: String) -> anyhow::Result<Config> {
    let config = config::Config::builder()
        .add_source(File::with_name(&config_path))
        .add_source(Environment::with_prefix("LAZER_AGENT").separator("__"))
        .build()?
        .try_deserialize()?;
    Ok(config)
}

// Default capacity for all tokio mpsc channels that communicate between tasks.
pub const CHANNEL_CAPACITY: usize = 1000;
