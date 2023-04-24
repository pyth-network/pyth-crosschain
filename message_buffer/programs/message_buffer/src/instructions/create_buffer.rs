use std::mem;
use anchor_lang::solana_program::message::MessageHeader;
use {
    crate::{
        state::*,
        MessageBufferError,
        MESSAGE,
    },
    anchor_lang::{
        prelude::*,
        system_program::{
            self,
            CreateAccount,
        },
    },
};

pub fn create_buffer<'info>(
    ctx: Context<'_, '_, '_, 'info, CreateBuffer<'info>>,
    allowed_program_auth: Pubkey,
    base_account_key: Pubkey,
    target_size: u32,
) -> Result<()> {
    let buffer_account = ctx
        .remaining_accounts
        .first()
        .ok_or(MessageBufferError::MessageBufferNotProvided)?;

    require_gte!(target_size, MessageBuffer::HEADER_LEN as u32, MessageBufferError::MessageBufferTooSmall);
    if is_uninitialized_account(buffer_account) {
        let (pda, bump) = Pubkey::find_program_address(
            &[
                allowed_program_auth.as_ref(),
                MESSAGE.as_bytes(),
                base_account_key.as_ref(),
            ],
            &crate::ID,
        );
        require_keys_eq!(buffer_account.key(), pda);
        let signer_seeds = [
            allowed_program_auth.as_ref(),
            MESSAGE.as_bytes(),
            base_account_key.as_ref(),
            &[bump],
        ];

        CreateBuffer::create_account(
            buffer_account,
            target_size as usize,
            &ctx.accounts.authority,
            &[signer_seeds.as_slice()],
            &ctx.accounts.system_program,
        )?;

        let loader = AccountLoader::<MessageBuffer>::try_from_unchecked(
            &crate::ID,
            buffer_account,
        )?;
        {
            let mut accumulator_input = loader.load_init()?;
            *accumulator_input = MessageBuffer::new(bump);
        }
        loader.exit(&crate::ID)?;
    }

    Ok(())
}

pub fn is_uninitialized_account(ai: &AccountInfo) -> bool {
    ai.data_is_empty() && ai.owner == &system_program::ID
}

#[derive(Accounts)]
pub struct CreateBuffer<'info> {
    #[account(
    seeds = [b"message".as_ref(), b"whitelist".as_ref()],
    bump = whitelist.bump,
    has_one = authority,
    )]
    pub whitelist: Account<'info, Whitelist>,

    // Also pays for account creation
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program:     Program<'info, System>,

    // remaining_accounts:  - [AccumulatorInput PDA]
}


impl<'info> CreateBuffer<'info> {
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
