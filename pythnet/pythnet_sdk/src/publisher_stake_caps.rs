use {
    crate::Pubkey,
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
};

/// This struct contains the parameters for the stake cap calculation.
/// - `m` - m is the cap per symbol, it gets split among all publishers of the symbol
/// - `z` - when a symbol has less than `z` publishers, each publisher gets a cap of `m/z` (instead of `m/number_of_publishers`). This is to prevent a single publisher from getting a large cap when there are few publishers.
///
/// The stake cap for a publisher is computed as the sum of `m/min(z, number_of_publishers)` for all the symbols the publisher is publishing.
#[derive(Clone, Copy, BorshDeserialize, BorshSerialize)]
pub struct StakeCapParameters {
    pub _discriminator:     u64,
    pub _current_authority: Pubkey,
    pub m:                  u64,
    pub z:                  u64,
}

impl Default for StakeCapParameters {
    fn default() -> Self {
        Self {
            _discriminator:     0,
            _current_authority: Pubkey::default(),
            m:                  1_000_000_000,
            z:                  1,
        }
    }
}
