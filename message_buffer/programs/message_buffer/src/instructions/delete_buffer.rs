use {
    crate::{
        state::*,
        MessageBufferError,
        MESSAGE,
    },
    anchor_lang::{
        prelude::*,
        solana_program::message::MessageHeader,
        system_program::{
            self,
            CreateAccount,
        },
    },
    std::mem,
};

pub fn delete_buffer<'info>(
    ctx: Context<'_, '_, '_, 'info, DeleteBuffer<'info>>,
    allowed_program_auth: Pubkey,
    base_account_key: Pubkey,
    bump: u8,
) -> Result<()> {
    let buffer_account = ctx
        .remaining_accounts
        .first()
        .ok_or(MessageBufferError::MessageBufferNotProvided)?;

    let expected_key = Pubkey::create_program_address(
        &[
            allowed_program_auth.as_ref(),
            MESSAGE.as_bytes(),
            base_account_key.as_ref(),
            &[bump],
        ],
        &crate::ID,
    )
    .map_err(|_| MessageBufferError::InvalidPDA)?;
    require_keys_eq!(buffer_account.key(), expected_key);
    let loader = AccountLoader::<MessageBuffer>::try_from_unchecked(&crate::ID, buffer_account)?;
    loader.close(ctx.accounts.authority.to_account_info())?;
    Ok(())
}

#[derive(Accounts)]
pub struct DeleteBuffer<'info> {
    #[account(
        seeds = [b"message".as_ref(), b"whitelist".as_ref()],
        bump = whitelist.bump,
        has_one = authority,
    )]
    pub whitelist: Account<'info, Whitelist>,

    // Also the recipient of the lamports from closing the buffer account
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    // remaining_account:  - [AccumulatorInput PDA]
}


impl<'info> DeleteBuffer<'info> {
    // FIXME: need to handle the case where someone transfers lamports to this account before it is created.
    fn create_account<'a>(
        account_info: &AccountInfo<'a>,
        space: usize,
        payer: &Signer<'a>,
        seeds: &[&[&[u8]]],
        system_program: &AccountInfo<'a>,
    ) -> Result<()> {
        let lamports = Rent::get()?.minimum_balance(space);
        system_program::create_account(
            CpiContext::new_with_signer(
                system_program.to_account_info(),
                CreateAccount {
                    from: payer.to_account_info(),
                    to:   account_info.to_account_info(),
                },
                seeds,
            ),
            lamports,
            space.try_into().unwrap(),
            &crate::ID,
        )?;
        Ok(())
    }
}
