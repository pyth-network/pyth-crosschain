use {
    crate::state::*,
    anchor_lang::prelude::*,
    std::mem,
};


pub fn put_all<'info>(
    ctx: Context<'_, '_, '_, 'info, PutAll<'info>>,
    _base_account_key: Pubkey,
    messages: Vec<Vec<u8>>,
) -> Result<()> {
    ctx.accounts.whitelist_verifier.is_allowed()?;

    let mut end_offsets = [0u16; u8::MAX as usize];
    {
        let msg_buffer_ai = ctx.accounts.message_buffer.to_account_info();
        let account_data = &mut msg_buffer_ai.try_borrow_mut_data()?;
        let header_end_index = mem::size_of::<MessageBuffer>() + 8;

        let (_, body_bytes) = account_data.split_at_mut(header_end_index);

        let (num_msgs, num_bytes) =
            MessageBuffer::put_all_in_buffer(body_bytes, &messages, &mut end_offsets);
        if num_msgs != messages.len() {
            msg!("unable to fit all messages in MessageBuffer account. Wrote {}/{} messages and {} bytes", num_msgs, messages.len(), num_bytes);
        }
    }

    let msg_buffer = &mut ctx.accounts.message_buffer.load_mut()?;
    msg_buffer.update_header(end_offsets);

    Ok(())
}

#[derive(Accounts)]
#[instruction(base_account_key: Pubkey)]
pub struct PutAll<'info> {
    pub whitelist_verifier: WhitelistVerifier<'info>,
    #[account(
        mut,
        seeds = [whitelist_verifier.cpi_caller_auth.key().as_ref(), b"message".as_ref(), base_account_key.as_ref()],
        bump = message_buffer.load()?.bump,
    )]
    pub message_buffer:     AccountLoader<'info, MessageBuffer>,
}
