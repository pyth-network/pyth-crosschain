use {
    crate::Pubkey,
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
};

#[derive(Default, Clone, Copy, BorshDeserialize, BorshSerialize)]
struct StakeCapParameters {
    pub _discriminator:     u64,
    pub _current_authority: Pubkey,
    pub m:                  u64,
    pub z:                  u64,
}
