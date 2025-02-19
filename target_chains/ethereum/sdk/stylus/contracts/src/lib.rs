#![allow(missing_docs)]
#![allow(clippy::pub_underscore_fields, clippy::module_name_repetitions)]
#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![deny(rustdoc::broken_intra_doc_links)]
#![allow(clippy::let_unit_value)]
extern crate alloc;

#[global_allocator]
static ALLOC: mini_alloc::MiniAlloc = mini_alloc::MiniAlloc::INIT;

/// Utility functions for interacting with the Pyth oracle.
/// This module contains functions for interacting with the Pyth oracle.
pub mod utils;

/// Pyth contract for interacting with the Pyth oracle.
/// This module contains the types and functions for interacting with the Pyth oracle.
pub mod pyth;

#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}
