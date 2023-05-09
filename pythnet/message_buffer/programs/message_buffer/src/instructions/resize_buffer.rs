use {
    crate::state::*,
    anchor_lang::prelude::*,
};


pub fn resize_buffer<'info>(
    ctx: Context<'_, '_, '_, 'info, ResizeBuffer<'info>>,
    allowed_program_auth: Pubkey,
    _base_account_key: Pubkey,
    _target_size: u32,
) -> Result<()> {
    ctx.accounts
        .whitelist
        .is_allowed_program_auth(&allowed_program_auth)?;
    Ok(())
}

#[derive(Accounts)]
#[instruction(
    allowed_program_auth: Pubkey, base_account_key: Pubkey, target_size: u32
)]
pub struct ResizeBuffer<'info> {
    #[account(
        seeds = [b"message".as_ref(), b"whitelist".as_ref()],
        bump = whitelist.bump,
        has_one = admin,
    )]
    pub whitelist: Account<'info, Whitelist>,

    // Also pays for account creation
    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// No need to check min length since realloc is first invoked
    /// and if target_size is too small, then load() will fail
    /// and Anchor automatically checks if increase
    /// exceeds MAX_PERMITTED_DATA_INCREASE
    #[account(
    mut,
    realloc = target_size as usize,
    realloc::zero = false,
    realloc::payer = admin,
    seeds = [allowed_program_auth.as_ref(), b"message".as_ref(), base_account_key.as_ref()],
    bump = message_buffer.load()?.bump,
    )]
    pub message_buffer: AccountLoader<'info, MessageBuffer>,
}
