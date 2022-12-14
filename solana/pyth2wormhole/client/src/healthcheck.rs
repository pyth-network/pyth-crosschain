use {
    std::{
        collections::VecDeque,
        sync::Arc,
    },
    tokio::sync::Mutex,
};

lazy_static::lazy_static! {
    pub static ref HEALTHCHECK_STATE: Arc<Mutex<HealthCheckState>> = Arc::new(Mutex::new(HealthCheckState::new(0)));
}

/// Helper structure for deciding service health
pub struct HealthCheckState {
    /// Sliding LIFO window over last `max_window_size` attestation results (true = ok, false = error)
    pub window:          VecDeque<bool>,
    /// Window size; 0 disables the healthcheck, causing it to always return None
    pub max_window_size: usize,
}


impl HealthCheckState {
    pub fn new(max_window_size: usize) -> Self {
        Self {
            window: VecDeque::with_capacity(max_window_size),
            max_window_size,
        }
    }
    /// Check service health, return None if not enough data is present
    pub fn is_healthy(&self) -> Option<bool> {
        if self.window.len() >= self.max_window_size && self.max_window_size > 0 {
            // If all results are false, return false (unhealthy).
            Some(self.window.iter().any(|entry| *entry))
        } else {
            // The window isn't big enough yet or the size is 0
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
