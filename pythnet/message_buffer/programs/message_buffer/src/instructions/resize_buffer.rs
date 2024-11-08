use {
    crate::{state::*, MessageBufferError, MESSAGE, WHITELIST},
    anchor_lang::prelude::*,
};

pub fn resize_buffer<'info>(
    ctx: Context<'_, '_, '_, 'info, ResizeBuffer<'info>>,
    allowed_program_auth: Pubkey,
    _base_account_key: Pubkey,
    target_size: u32,
) -> Result<()> {
    ctx.accounts
        .whitelist
        .is_allowed_program_auth(&allowed_program_auth)?;

    let message_buffer = &ctx.accounts.message_buffer.load()?;
    let max_end_offset = message_buffer.end_offsets.iter().max().unwrap();
    let minimum_size = max_end_offset + message_buffer.header_len;
    require_gte!(
        target_size as usize,
        minimum_size as usize,
        MessageBufferError::MessageBufferTooSmall
    );

    require_gte!(
        MessageBuffer::MAX_LEN as usize,
        target_size as usize,
        MessageBufferError::TargetSizeExceedsMaxLen
    );

    Ok(())
}

#[derive(Accounts)]
#[instruction(
    allowed_program_auth: Pubkey, base_account_key: Pubkey, target_size: u32
)]
pub struct ResizeBuffer<'info> {
    #[account(
        seeds = [MESSAGE.as_bytes(), WHITELIST.as_bytes()],
        bump = whitelist.bump,
        has_one = admin,
    )]
    pub whitelist: Account<'info, Whitelist>,

    pub admin: Signer<'info>,

    /// Pays for any additional rent needed to increase the buffer size
    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// If decreasing, Anchor will automatically check
    /// if target_size is < MessageBuffer::INIT_SPACE + 8
    /// and if so,then load() will fail.
    /// If increasing, Anchor also automatically checks if target_size delta
    /// exceeds MAX_PERMITTED_DATA_INCREASE
    #[account(
        mut,
        realloc = target_size as usize,
        realloc::zero = false,
        realloc::payer = payer,
        seeds = [allowed_program_auth.as_ref(), MESSAGE.as_bytes(), base_account_key.as_ref()],
        bump = message_buffer.load()?.bump,
    )]
    pub message_buffer: AccountLoader<'info, MessageBuffer>,
}
