#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;

use pyth_stylus::pyth::pyth_contract::PythContract;
use stylus_sdk::prelude::{entrypoint, public, sol_storage};

sol_storage! {
    #[entrypoint]
    struct ProxyCallsExample {
        #[borrow]
        PythContract pyth
    }
}

#[public]
#[inherit(PythContract)]
impl ProxyCallsExample {}
