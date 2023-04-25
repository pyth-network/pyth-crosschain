use {
    crate::{
        state::MessageBuffer,
        MessageBufferError,
    },
    anchor_lang::{
        prelude::*,
        system_program,
        Discriminator,
    },
};
pub use {
    create_buffer::*,
    delete_buffer::*,
    put_all::*,
    resize_buffer::*,
};


mod create_buffer;
mod delete_buffer;
mod put_all;
mod resize_buffer;

// String constants for deriving PDAs.
// An authorized program's message buffer will have PDA seeds [authorized_program_pda, MESSAGE, base_account_key],
// where authorized_program_pda is the
pub const MESSAGE: &str = "message";
pub const FUND: &str = "fund";


pub fn is_uninitialized_account(ai: &AccountInfo) -> bool {
    ai.data_is_empty() && ai.owner == &system_program::ID
}

/// Verify message buffer account is initialized and has the correct discriminator.
///
/// Note: manually checking because using anchor's `AccountLoader.load()`
/// will panic since the `AccountInfo.data_len()` will not match the
/// size of the `MessageBuffer` since the `MessageBuffer` struct does not
/// include the messages.
pub fn verify_message_buffer(message_buffer_account_info: &AccountInfo) -> Result<()> {
    if is_uninitialized_account(message_buffer_account_info) {
        return err!(MessageBufferError::MessageBufferUninitialized);
    }
    let data = message_buffer_account_info.try_borrow_data()?;
    if data.len() < MessageBuffer::discriminator().len() {
        return Err(ErrorCode::AccountDiscriminatorNotFound.into());
    }

    let disc_bytes = &data[0..8];
    if disc_bytes != &MessageBuffer::discriminator() {
        return Err(ErrorCode::AccountDiscriminatorMismatch.into());
    }
    Ok(())
}
