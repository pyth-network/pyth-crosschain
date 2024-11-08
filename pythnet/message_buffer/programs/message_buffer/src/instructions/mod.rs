use anchor_lang::{prelude::*, system_program};
pub use {create_buffer::*, delete_buffer::*, put_all::*, resize_buffer::*};

mod create_buffer;
mod delete_buffer;
mod put_all;
mod resize_buffer;

// String constants for deriving PDAs.
//
// An authorized program's message buffer will have PDA seeds [authorized_program_pda, MESSAGE, base_account_key],
// where authorized_program_pda is the where `allowed_program_auth`
// is the whitelisted pubkey who authorized this call.
pub const MESSAGE: &str = "message";
pub const WHITELIST: &str = "whitelist";

pub fn is_uninitialized_account(ai: &AccountInfo) -> bool {
    ai.data_is_empty() && ai.owner == &system_program::ID
}
