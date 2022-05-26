use tokio::sync::{Mutex, MutexGuard};
use std::{ops::{Deref, DerefMut}, time::{Duration, Instant}};

/// Rate-limited mutex.
pub struct RLMutex<T> {
    mtx: Mutex<RLMutexState<T>>,
    rl_interval: Duration,
}

/// Helper to make the last_released writes also guarded by the mutex
pub struct RLMutexState<T> {
    /// Helps make sure regular passage of time is subtracted from sleep duration 
    last_released: Instant,
    val: T,
}

impl<T> Deref for RLMutexState<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        &self.val
    }
}

impl<T> DerefMut for RLMutexState<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.val
    }
}


/// Helper wrapper to record lock release times via Drop
pub struct RLMutexGuard<'a, T> {
    guard: MutexGuard<'a, RLMutexState<T>>,
}

impl<'a, T> Drop for RLMutexGuard<'a, T> {
    fn drop(&mut self) {
        let state: &mut RLMutexState<T> = MutexGuard::<'a, RLMutexState<T>>::deref_mut(&mut self.guard);
        state.last_released = Instant::now();
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
            mtx: Mutex::new(RLMutexState {
                last_released: Instant::now() - rl_interval,
                val
            }),
            rl_interval,
        }
    }

    pub async fn lock(&self) -> RLMutexGuard<'_, T> {
        let elapsed = self.mtx.lock().await.last_released.elapsed();
        if elapsed < self.rl_interval {
            tokio::time::sleep(self.rl_interval - elapsed).await;
        }
            
        RLMutexGuard {
            guard: self.mtx.lock().await,
        }
    }
}

