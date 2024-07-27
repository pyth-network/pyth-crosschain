use std::time::Duration;

const DEFAULT_TIMEOUT: u64 = 5000;

#[derive(Debug)]
pub struct HermesClientConfig {
    /// Timeout of each request (for all of retries). Default: 5000ms
    timeout: Option<Duration>,
}

#[derive(Debug)]
pub struct HermesClient {
    base_url: String,
    timeout: Duration,
}

impl HermesClient {
    pub fn new(endpoint: &str, config: Option<HermesClientConfig>) -> Self {
        let timeout;

        match config {
            Some(config) => {
                timeout = config
                    .timeout
                    .unwrap_or(Duration::from_millis(DEFAULT_TIMEOUT));
            }
            None => {
                timeout = Duration::from_millis(DEFAULT_TIMEOUT);
            }
        }

        Self {
            base_url: endpoint.to_string(),
            timeout,
        }
    }

}
