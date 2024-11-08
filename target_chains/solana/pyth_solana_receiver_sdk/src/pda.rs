use {crate::ID, anchor_lang::prelude::*};

pub const CONFIG_SEED: &str = "config";
pub const TREASURY_SEED: &str = "treasury";

// There is one treasury for each u8 value
// This is to load balance the write load
pub fn get_treasury_address(treasury_id: u8) -> Pubkey {
    Pubkey::find_program_address(&[TREASURY_SEED.as_ref(), &[treasury_id]], &ID).0
}

pub fn get_config_address() -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED.as_ref()], &ID).0
}
