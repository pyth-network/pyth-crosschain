#![cfg_attr(not(feature = "export-abi"), no_main)]
extern crate alloc;


/// Import items from the SDK. The prelude contains common traits and macros.
use stylus_sdk::{ prelude::*, stylus_proc::entrypoint, alloy_sol_types::sol};
use pyth_stylus::pyth::get_ema_price_unsafe;
use alloy_primitives::{ FixedBytes, Address };

// Define some persistent storage using the Solidity ABI.
// `Counter` will be the entrypoint.

sol!{
    error AlreadyInitialized();
}


#[derive(SolidityError)]
pub enum PythUseError {

     AlreadyInitialized(AlreadyInitialized),
}

sol_storage! {
    #[entrypoint]
    pub struct PythUse {
        address pyth;
    }
}

/// Declare that `Counter` is a contract with the following external methods.
#[public]
impl PythUse {
    pub fn initialize(&mut self, ipth_address: Address) {
        self.pyth.set(ipth_address);
    }
      /// Gets the number from storage.
    pub fn number(&mut self, id:FixedBytes<32>) {
          let _ = get_ema_price_unsafe(self, self.pyth.get(), id);

    }
}