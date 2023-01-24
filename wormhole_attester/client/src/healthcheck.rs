use {
    crate::attestation_cfg,
    std::{
        collections::VecDeque,
        convert::TryInto,
        sync::Arc,
    },
    tokio::sync::Mutex,
};

lazy_static::lazy_static! {
    pub static ref HEALTHCHECK_STATE: Arc<Mutex<HealthCheckState>> = Arc::new(Mutex::new(HealthCheckState::new(attestation_cfg::default_healthcheck_window_size().try_into().expect("could not convert window size to usize"), attestation_cfg::default_enable_healthcheck())));
}

/// Helper structure for deciding service health
pub struct HealthCheckState {
    /// Whether to report the healthy/unhealthy status
    pub enable:          bool,
    /// Sliding LIFO window over last `max_window_size` attestation results (true = ok, false = error)
    pub window:          VecDeque<bool>,
    /// Window size
    pub max_window_size: usize,
}


impl HealthCheckState {
    pub fn new(max_window_size: usize, enable: bool) -> Self {
        Self {
            enable,
            window: VecDeque::with_capacity(max_window_size),
            max_window_size,
        }
    }
    /// Check service health, return None if not enough data is present
    pub fn is_healthy(&self) -> Option<bool> {
        if self.window.len() >= self.max_window_size && self.enable {
            // If all results are false, return false (unhealthy).
            Some(self.window.iter().any(|entry| *entry))
        } else {
            // The window isn't big enough yet or the healthcheck is disabled
            None
        }
    }

    /// Rotate the window
    pub fn add_result(&mut self, res: bool) {
        self.window.push_front(res);

        // Trim window back to size if needed. truncate() deletes from
        // the back and has no effect if new size is greater than
        // current size.
        self.window.truncate(self.max_window_size);
    }
}
