use {
    crate::state::*,
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
        seeds = [b"message".as_ref(), b"whitelist".as_ref()],
        bump = whitelist.bump,
        has_one = admin,
    )]
    pub whitelist: Account<'info, Whitelist>,

    // Also the recipient of the lamports from closing the buffer account
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
    mut,
    close = admin,
    seeds = [allowed_program_auth.as_ref(), b"message".as_ref(), base_account_key.as_ref()],
    bump = message_buffer.load()?.bump,
    )]
    pub message_buffer: AccountLoader<'info, MessageBuffer>,
}
