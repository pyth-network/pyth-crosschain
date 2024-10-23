//! Unit-testing context for Stylus contracts.
use std::sync::{Mutex, MutexGuard};

use stylus_sdk::{alloy_primitives::uint, prelude::StorageType};

use crate::storage::reset_storage;

/// A global static mutex.
///
/// We use this for scenarios where concurrent mutation of storage is wanted.
/// For example, when a test harness is running, this ensures each test
/// accesses storage in an non-overlapping manner.
///
/// See [`with_context`].
pub(crate) static STORAGE_MUTEX: Mutex<()> = Mutex::new(());

/// Acquires access to storage.
pub fn acquire_storage() -> MutexGuard<'static, ()> {
    STORAGE_MUTEX.lock().unwrap_or_else(|e| {
        reset_storage();
        e.into_inner()
    })
}

/// Decorates a closure by running it with exclusive access to storage.
#[allow(clippy::module_name_repetitions)]
pub fn with_context<C: StorageType>(closure: impl FnOnce(&mut C)) {
    let _lock = acquire_storage();
    let mut contract = C::default();
    closure(&mut contract);
    reset_storage();
}

/// Initializes fields of contract storage and child contract storages with
/// default values.
pub trait DefaultStorage: StorageType {
    /// Initializes fields of contract storage and child contract storages with
    /// default values.
    #[must_use]
    fn default() -> Self {
        unsafe { Self::new(uint!(0_U256), 0) }
    }
}

impl<ST: StorageType> DefaultStorage for ST {}
