//#![deny(warnings)]

use near_sdk::{
    borsh::{
        self,
        BorshDeserialize,
        BorshSerialize,
    },
    near_bindgen,
    PanicOnDefault,
};

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct State {}

#[near_bindgen]
impl State {
    #[init]
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Self {}
    }

    #[payable]
    pub fn verify_vaa(&mut self, _vaa: String) -> u32 {
        0
    }
}
