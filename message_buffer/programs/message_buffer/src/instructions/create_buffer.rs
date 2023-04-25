use {
    crate::{
        instructions::is_uninitialized_account,
        state::*,
        MessageBufferError,
        MESSAGE,
    },
    anchor_lang::{
        prelude::*,
        solana_program::message::MessageHeader,
        system_program::{
            self,
            Allocate,
            Assign,
            CreateAccount,
            Transfer,
        },
    },
    std::mem,
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

    require_gte!(
        target_size,
        MessageBuffer::HEADER_LEN as u32,
        MessageBufferError::MessageBufferTooSmall
    );
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
            &ctx.accounts.admin,
            &[signer_seeds.as_slice()],
            &ctx.accounts.system_program,
        )?;

        let loader =
            AccountLoader::<MessageBuffer>::try_from_unchecked(&crate::ID, buffer_account)?;
        {
            let mut accumulator_input = loader.load_init()?;
            *accumulator_input = MessageBuffer::new(bump);
        }
        loader.exit(&crate::ID)?;
    }

    Ok(())
}


#[derive(Accounts)]
pub struct CreateBuffer<'info> {
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


impl<'info> CreateBuffer<'info> {
    /// Manually invoke transfer, allocate & assign ixs to create an account
    /// to handle situation where an account already has lamports
    /// since system_program::create_account will fail in this case
    fn create_account<'a>(
        new_account_info: &AccountInfo<'a>,
        space: usize,
        payer: &Signer<'a>,
        seeds: &[&[&[u8]]],
        system_program: &AccountInfo<'a>,
    ) -> Result<()> {
        let target_rent = Rent::get()?.minimum_balance(space);
        if new_account_info.lamports() < target_rent {
            system_program::transfer(
                CpiContext::new_with_signer(
                    system_program.to_account_info(),
                    Transfer {
                        from: payer.to_account_info(),
                        to:   new_account_info.to_account_info(),
                    },
                    seeds,
                ),
                target_rent - new_account_info.lamports(),
            )?;
        };

        system_program::allocate(
            CpiContext::new_with_signer(
                system_program.to_account_info(),
                Allocate {
                    account_to_allocate: new_account_info.to_account_info(),
                },
                seeds,
            ),
            space.try_into().unwrap(),
        )?;

        system_program::assign(
            CpiContext::new_with_signer(
                system_program.to_account_info(),
                Assign {
                    account_to_assign: new_account_info.to_account_info(),
                },
                seeds,
            ),
            &crate::ID,
        )?;

        Ok(())
    }
}
