use {
    crate::{state::*, MESSAGE},
    anchor_lang::prelude::*,
};

pub fn put_all<'info>(
    ctx: Context<'_, '_, '_, 'info, PutAll<'info>>,
    _base_account_key: Pubkey,
    messages: Vec<Vec<u8>>,
) -> Result<()> {
    ctx.accounts.whitelist_verifier.is_allowed()?;

    let msg_buffer_ai = ctx.accounts.message_buffer.to_account_info();
    let account_data = &mut msg_buffer_ai.try_borrow_mut_data()?;
    let header_end_index = MessageBuffer::HEADER_LEN as usize;

    let (header_bytes, body_bytes) = account_data.split_at_mut(header_end_index);

    let message_buffer: &mut MessageBuffer = bytemuck::from_bytes_mut(&mut header_bytes[8..]);

    message_buffer.refresh_header();
    let (num_msgs, num_bytes) = message_buffer.put_all_in_buffer(body_bytes, &messages);
    if num_msgs != messages.len() {
        msg!("unable to fit all messages in MessageBuffer account. Wrote {}/{} messages and {} bytes", num_msgs, messages.len(), num_bytes);
    }
    Ok(())
}

#[derive(Accounts)]
#[instruction(base_account_key: Pubkey)]
pub struct PutAll<'info> {
    pub whitelist_verifier: WhitelistVerifier<'info>,
    #[account(
        mut,
        seeds = [whitelist_verifier.cpi_caller_auth.key().as_ref(), MESSAGE.as_bytes(), base_account_key.as_ref()],
        bump = message_buffer.load()?.bump,
    )]
    pub message_buffer: AccountLoader<'info, MessageBuffer>,
}
