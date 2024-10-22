use std::time::Duration;

use alloy::primitives::Address;
use reqwest::Url;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    #[allow(dead_code)]
    pub contract_address: Address,
    pub hermes: HermesConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct HermesConfig {
    pub endpoint: Url,
    #[serde(with = "humantime_serde")]
    pub single_request_timeout: Duration,
    #[serde(with = "humantime_serde")]
    pub total_retry_timeout: Duration,
    #[serde(with = "humantime_serde")]
    pub stream_progress_timeout: Duration,
    #[serde(with = "humantime_serde")]
    pub stream_disconnect_delay: Duration,
}
