#![cfg_attr(not(test), no_std, no_main)]
extern crate alloc;


use stylus_sdk::prelude::{entrypoint,public, sol_storage,};
use pyth_stylus::pyth::pyth_contract::PythContract;


sol_storage! {
    #[entrypoint]
    struct ProxyCallsExample {
        #[borrow]
        PythContract pyth
    }
}

#[public]
#[inherit(PythContract)]
impl ProxyCallsExample {
}