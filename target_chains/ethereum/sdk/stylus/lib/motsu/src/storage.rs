//! Shims for storage operations.
use std::{collections::HashMap, ptr, sync::Mutex};

use once_cell::sync::Lazy;

use crate::shims::{Bytes32, WORD_BYTES};

/// Storage mock: A global mutable key-value store.
pub(crate) static STORAGE: Lazy<Mutex<HashMap<Bytes32, Bytes32>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Read the word at address `key`.
pub(crate) unsafe fn read_bytes32(key: *const u8) -> Bytes32 {
    let mut res = Bytes32::default();
    ptr::copy(key, res.as_mut_ptr(), WORD_BYTES);
    res
}

/// Write the word `val` to the location pointed by `key`.
pub(crate) unsafe fn write_bytes32(key: *mut u8, val: Bytes32) {
    ptr::copy(val.as_ptr(), key, WORD_BYTES);
}

/// Clears storage, removing all key-value pairs.
///
/// # Panics
///
/// May panic if the storage lock is already held by the current thread.
#[allow(clippy::module_name_repetitions)]
pub fn reset_storage() {
    STORAGE.lock().unwrap().clear();
}
