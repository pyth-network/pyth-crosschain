use {
    crate::{state::*, MESSAGE, WHITELIST},
    anchor_lang::prelude::*,
};

pub fn delete_buffer<'info>(
    _ctx: Context<'_, '_, '_, 'info, DeleteBuffer<'info>>,
    _allowed_program_auth: Pubkey,
    _base_account_key: Pubkey,
) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
#[instruction(allowed_program_auth: Pubkey, base_account_key: Pubkey)]
pub struct DeleteBuffer<'info> {
    #[account(
        seeds = [MESSAGE.as_bytes(), WHITELIST.as_bytes()],
        bump = whitelist.bump,
        has_one = admin,
    )]
    pub whitelist: Account<'info, Whitelist>,

    pub admin: Signer<'info>,

    /// Recipient of the lamports from closing the buffer account
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        close = payer,
        seeds = [allowed_program_auth.as_ref(), MESSAGE.as_bytes(), base_account_key.as_ref()],
        bump = message_buffer.load()?.bump,
    )]
    pub message_buffer: AccountLoader<'info, MessageBuffer>,
}
