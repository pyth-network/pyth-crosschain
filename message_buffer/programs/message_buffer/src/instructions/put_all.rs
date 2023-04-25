use {
    crate::{
        instructions::verify_message_buffer,
        state::*,
        MessageBufferError,
    },
    anchor_lang::prelude::*,
    std::mem,
};


pub fn put_all<'info>(
    ctx: Context<'_, '_, '_, 'info, PutAll<'info>>,
    base_account_key: Pubkey,
    messages: Vec<Vec<u8>>,
) -> Result<()> {
    let cpi_caller_auth = ctx.accounts.whitelist_verifier.is_allowed()?;
    let message_buffer_account_info = ctx
        .remaining_accounts
        .first()
        .ok_or(MessageBufferError::MessageBufferNotProvided)?;

    verify_message_buffer(message_buffer_account_info)?;

    let account_data = &mut message_buffer_account_info.try_borrow_mut_data()?;
    let header_end_index = mem::size_of::<MessageBuffer>() + 8;

    let (header_bytes, body_bytes) = account_data.split_at_mut(header_end_index);

    let message_buffer: &mut MessageBuffer = bytemuck::from_bytes_mut(&mut header_bytes[8..]);

    message_buffer.validate(
        message_buffer_account_info.key(),
        cpi_caller_auth,
        base_account_key,
    )?;

    message_buffer.refresh_header();

    let (num_msgs, num_bytes) = message_buffer.put_all_in_buffer(body_bytes, &messages);

    if num_msgs != messages.len() {
        // FIXME: make this into an emit! event
        msg!("unable to fit all messages in accumulator input account. Wrote {}/{} messages and {} bytes", num_msgs, messages.len(), num_bytes);
    }

    Ok(())
}

#[derive(Accounts)]
#[instruction( base_account_key: Pubkey)]
pub struct PutAll<'info> {
    pub whitelist_verifier: WhitelistVerifier<'info>,
    // remaining_accounts:  - [AccumulatorInput PDA]
}
