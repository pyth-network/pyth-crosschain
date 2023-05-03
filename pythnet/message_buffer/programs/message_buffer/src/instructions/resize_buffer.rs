use {
    crate::{
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
    MessageBuffer::check_discriminator(message_buffer_account_info)?;


    let target_size = target_size as usize;

    let current_account_size = message_buffer_account_info.data_len();
    let target_size_delta = target_size.saturating_sub(current_account_size);
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

    // allow for target_size == account_size in case Rent requirements have changed
    // and additional lamports need to be transferred.
    // the realloc step will be a no-op in this case.
    if target_size >= current_account_size {
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
        // Check that account doesn't get resized to smaller than the amount of
        // data it is currently holding (if any)
        {
            let account_data = &message_buffer_account_info.try_borrow_data()?;
            let header_end_index = std::mem::size_of::<MessageBuffer>() + 8;
            let (header_bytes, _) = account_data.split_at(header_end_index);
            let message_buffer: &MessageBuffer = bytemuck::from_bytes(&header_bytes[8..]);
            let max_end_offset = message_buffer.end_offsets.iter().max().unwrap();
            let minimum_size = max_end_offset + message_buffer.header_len;
            require_gte!(
                target_size,
                minimum_size as usize,
                MessageBufferError::MessageBufferTooSmall
            );
        }


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
