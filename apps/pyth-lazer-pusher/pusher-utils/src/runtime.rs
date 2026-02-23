//! Application runtime for task management and graceful shutdown.

use std::future::Future;
use std::time::Duration;
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;
use tokio_util::task::TaskTracker;

/// Application runtime for managing tasks and coordinating graceful shutdown.
///
/// Provides:
/// - Task spawning with automatic tracking
/// - Shutdown signaling to all tasks
/// - Waiting for all tasks to complete on shutdown
///
/// # Example
///
/// ```ignore
/// let runtime = AppRuntime::new();
///
/// // Spawn tracked tasks
/// let rt = runtime.clone();
/// runtime.spawn(async move {
///     loop {
///         tokio::select! {
///             _ = rt.cancelled() => break,
///             _ = do_work() => {}
///         }
///     }
/// });
///
/// // Trigger shutdown and wait for all tasks
/// runtime.shutdown();
/// runtime.wait_for_tasks(Duration::from_secs(5)).await;
/// ```
#[derive(Clone)]
pub struct AppRuntime {
    token: CancellationToken,
    tracker: TaskTracker,
}

impl AppRuntime {
    /// Create a new application runtime.
    pub fn new() -> Self {
        Self {
            token: CancellationToken::new(),
            tracker: TaskTracker::new(),
        }
    }

    /// Spawn a task that will be tracked for graceful shutdown.
    ///
    /// Use this instead of `tokio::spawn()` to ensure the task is awaited
    /// during shutdown.
    pub fn spawn<F>(&self, future: F) -> JoinHandle<F::Output>
    where
        F: Future + Send + 'static,
        F::Output: Send + 'static,
    {
        self.tracker.spawn(future)
    }

    /// Initiate shutdown, signaling all tasks to stop.
    ///
    /// This closes the task tracker (preventing new spawns) and cancels
    /// the token so all tasks watching `cancelled()` are notified.
    pub fn shutdown(&self) {
        self.tracker.close();
        self.token.cancel();
    }

    /// Check if shutdown has been initiated.
    pub fn is_shutdown(&self) -> bool {
        self.token.is_cancelled()
    }

    /// Wait until shutdown is initiated.
    ///
    /// Use this in `tokio::select!` to detect shutdown:
    /// ```ignore
    /// tokio::select! {
    ///     _ = runtime.cancelled() => break,
    ///     msg = receiver.recv() => { /* handle */ }
    /// }
    /// ```
    pub async fn cancelled(&self) {
        self.token.cancelled().await;
    }

    /// Wait for all tracked tasks to complete, with a timeout.
    ///
    /// Returns `true` if all tasks completed, `false` if timed out.
    pub async fn wait_for_tasks(&self, timeout: Duration) -> bool {
        tokio::time::timeout(timeout, self.tracker.wait())
            .await
            .is_ok()
    }

    /// Get the number of currently tracked tasks.
    pub fn task_count(&self) -> usize {
        self.tracker.len()
    }
}

impl Default for AppRuntime {
    fn default() -> Self {
        Self::new()
    }
}
