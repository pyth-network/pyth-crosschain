use tokio::sync::{Mutex, MutexGuard};
use std::{ops::{Deref, DerefMut}, time::{Duration, Instant}};

/// Rate-limited mutex.
pub struct RLMutex<T> {
    mtx: Mutex<T>,
    /// Helps make sure regular passage of time is subtracted from sleep duration 
    last_released_mtx: std::sync::Mutex<Instant>,
    rl_interval: Duration,
}

/// Helper wrapper to record lock release times via Drop
pub struct RLMutexGuard<'a, T> {
    guard: MutexGuard<'a, T>,
    rl: &'a RLMutex<T>,
}

impl<'a, T> Drop for RLMutexGuard<'a, T> {
    fn drop(&mut self) {
        *self.rl.last_released_mtx.lock().unwrap() = Instant::now();
    }
}

impl<'a, T> Deref for RLMutexGuard<'a, T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        self.guard.deref()
    }
}

impl<'a, T> DerefMut for RLMutexGuard<'a, T> {
    fn deref_mut(&mut self) -> &mut T {
        self.guard.deref_mut()
    }
}

impl<T> RLMutex<T> {
    pub fn new(val: T, rl_interval: Duration) -> Self {
        Self {
            mtx: Mutex::new(val),
            rl_interval,
            last_released_mtx: std::sync::Mutex::new(Instant::now() - rl_interval),
        }
    }

    pub async fn lock(&self) -> RLMutexGuard<'_, T> {
        let elapsed = self.last_released_mtx.lock().unwrap().elapsed();
        if elapsed < self.rl_interval {
            tokio::time::sleep(self.rl_interval - elapsed).await;
        }
            
        RLMutexGuard {
            guard: self.mtx.lock().await,
            rl: self,
        }
    }
}

