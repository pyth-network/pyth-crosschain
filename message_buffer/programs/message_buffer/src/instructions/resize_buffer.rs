use {
    crate::{
        instructions::verify_message_buffer,
        state::*,
        MessageBufferError,
        MESSAGE,
    },
    anchor_lang::{
        prelude::*,
        solana_program::entrypoint::MAX_PERMITTED_DATA_INCREASE,
        system_program::{
            self,
            Transfer,
        },
    },
};

pub fn resize_buffer<'info>(
    ctx: Context<'_, '_, '_, 'info, ResizeBuffer<'info>>,
    allowed_program_auth: Pubkey,
    base_account_key: Pubkey,
    buffer_bump: u8,
    target_size: u32,
) -> Result<()> {
    let message_buffer_account_info = ctx
        .remaining_accounts
        .first()
        .ok_or(MessageBufferError::MessageBufferNotProvided)?;

    ctx.accounts
        .whitelist
        .is_allowed_program_auth(&allowed_program_auth)?;
    verify_message_buffer(message_buffer_account_info)?;

    require_gte!(
        target_size,
        MessageBuffer::HEADER_LEN as u32,
        MessageBufferError::MessageBufferTooSmall
    );
    let target_size = target_size as usize;
    let target_size_delta = target_size.saturating_sub(message_buffer_account_info.data_len());
    require_gte!(
        MAX_PERMITTED_DATA_INCREASE,
        target_size_delta,
        MessageBufferError::TargetSizeDeltaExceeded
    );

    let expected_key = Pubkey::create_program_address(
        &[
            allowed_program_auth.as_ref(),
            MESSAGE.as_bytes(),
            base_account_key.as_ref(),
            &[buffer_bump],
        ],
        &crate::ID,
    )
    .map_err(|_| MessageBufferError::InvalidPDA)?;

    require_keys_eq!(
        message_buffer_account_info.key(),
        expected_key,
        MessageBufferError::InvalidPDA
    );

    if target_size_delta > 0 {
        let target_rent = Rent::get()?.minimum_balance(target_size);
        if message_buffer_account_info.lamports() < target_rent {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.admin.to_account_info(),
                        to:   message_buffer_account_info.to_account_info(),
                    },
                ),
                target_rent - message_buffer_account_info.lamports(),
            )?;
        }
        message_buffer_account_info
            .realloc(target_size, false)
            .map_err(|_| MessageBufferError::ReallocFailed)?;
    } else {
        // Not transferring excess lamports back to admin.
        // Account will retain more lamports than necessary.
        message_buffer_account_info.realloc(target_size, false)?;
    }
    Ok(())
}

#[derive(Accounts)]
#[instruction(
    allowed_program_auth: Pubkey, base_account_key: Pubkey,
    buffer_bump: u8, target_size: u32
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
    // remaining_accounts:  - [AccumulatorInput PDA]
}
