use {
    crate::{
        state::*,
        AccumulatorUpdaterError,
    },
    anchor_lang::{
        prelude::*,
        system_program::{
            self,
            CreateAccount,
        },
    },
};


pub const ACCUMULATOR: &[u8; 11] = b"accumulator";

/// Puts all
///
pub fn put_all<'info>(
    ctx: Context<'_, '_, '_, 'info, PutAll<'info>>,
    base_account_key: Pubkey,
    messages: Vec<Vec<u8>>,
) -> Result<()> {
    let cpi_caller = ctx.accounts.whitelist_verifier.is_allowed()?;
    let accumulator_input_ai = ctx
        .remaining_accounts
        .first()
        .ok_or(AccumulatorUpdaterError::AccumulatorInputNotProvided)?;

    let loader;

    {
        let accumulator_input = &mut (if is_uninitialized_account(accumulator_input_ai) {
            let (pda, bump) = Pubkey::find_program_address(
                &[
                    cpi_caller.as_ref(),
                    ACCUMULATOR.as_ref(),
                    base_account_key.as_ref(),
                ],
                &crate::ID,
            );
            require_keys_eq!(accumulator_input_ai.key(), pda);
            let signer_seeds = &[
                cpi_caller.as_ref(),
                ACCUMULATOR.as_ref(),
                base_account_key.as_ref(),
                &[bump],
            ];
            PutAll::create_account(
                accumulator_input_ai,
                8 + AccumulatorInput::INIT_SPACE,
                &ctx.accounts.payer,
                signer_seeds,
                &ctx.accounts.system_program,
            )?;
            loader = AccountLoader::<AccumulatorInput>::try_from_unchecked(
                &crate::ID,
                accumulator_input_ai,
            )?;
            let mut accumulator_input = loader.load_init()?;
            accumulator_input.header = AccumulatorHeader::new(bump);
            accumulator_input
        } else {
            loader = AccountLoader::<AccumulatorInput>::try_from(accumulator_input_ai)?;
            let mut accumulator_input = loader.load_mut()?;
            accumulator_input.header.set_version();
            accumulator_input
        });
        // note: redundant for uninitialized code path but safer to check here.
        // compute budget cost should be minimal
        accumulator_input.validate(accumulator_input_ai.key(), cpi_caller, base_account_key)?;


        // accumulator_input.put_all_old(messages)?;


        let (num_msgs, num_bytes) = accumulator_input.put_all(&messages);
        if num_msgs != messages.len() {
            msg!("unable to fit all messages in accumulator input account. Wrote {}/{} messages and {} bytes", num_msgs, messages.len(), num_bytes);
        }
    }


    loader.exit(&crate::ID)?;

    Ok(())
}

pub fn is_uninitialized_account(ai: &AccountInfo) -> bool {
    ai.data_is_empty() && ai.owner == &system_program::ID
}

#[derive(Accounts)]
#[instruction( base_account_key: Pubkey)]
pub struct PutAll<'info> {
    #[account(mut)]
    pub payer:              Signer<'info>,
    pub whitelist_verifier: WhitelistVerifier<'info>,
    pub system_program:     Program<'info, System>,
    // remaining_accounts:  - [AccumulatorInput PDA]
}

impl<'info> PutAll<'info> {
    fn create_account<'a>(
        account_info: &AccountInfo<'a>,
        space: usize,
        payer: &AccountInfo<'a>,
        seeds: &[&[u8]],
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
                &[seeds],
            ),
            lamports,
            space.try_into().unwrap(),
            &crate::ID,
        )?;
        Ok(())
    }
}
