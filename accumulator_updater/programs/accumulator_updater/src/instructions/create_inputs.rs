use {
    crate::{
        accumulator_acc_seeds,
        accumulator_acc_seeds_with_bump,
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


pub fn create_inputs<'info>(
    ctx: Context<'_, '_, '_, 'info, CreateInputs<'info>>,
    base_account: Pubkey,
    data: Vec<Vec<u8>>,
    account_type: u32,
    account_schemas: Vec<u8>,
) -> Result<()> {
    let cpi_caller = ctx.accounts.whitelist_verifier.is_allowed()?;
    let accts = ctx.remaining_accounts;
    require_eq!(accts.len(), data.len());
    require_eq!(data.len(), account_schemas.len());
    let mut zip = data.into_iter().zip(account_schemas.into_iter());

    let rent = Rent::get()?;

    for ai in accts {
        let (account_data, account_schema) = zip.next().unwrap();
        let seeds = accumulator_acc_seeds!(cpi_caller, base_account, account_schema);
        let (pda, bump) = Pubkey::find_program_address(seeds, &crate::ID);
        require_keys_eq!(ai.key(), pda);

        //TODO: Update this with serialization logic
        let accumulator_size = 8 + AccumulatorInput::get_initial_size(&account_data);
        let accumulator_input = AccumulatorInput::new(
            AccumulatorHeader::new(
                bump,
                1, //from CPI caller?
                account_type,
                account_schema,
            ),
            account_data,
        );
        CreateInputs::create_and_initialize_accumulator_input_pda(
            ai,
            accumulator_input,
            accumulator_size,
            &ctx.accounts.payer,
            &[accumulator_acc_seeds_with_bump!(
                cpi_caller,
                base_account,
                account_schema,
                bump
            )],
            &rent,
            &ctx.accounts.system_program,
        )?;
    }

    Ok(())
}

#[derive(Accounts)]
#[instruction(base_account: Pubkey, data: Vec<Vec<u8>>, account_type: u32)] // only needed if using optional accounts
pub struct CreateInputs<'info> {
    #[account(mut)]
    pub payer:              Signer<'info>,
    pub whitelist_verifier: WhitelistVerifier<'info>,
    pub system_program:     Program<'info, System>,
    //TODO: decide on using optional accounts vs ctx.remaining_accounts
    //      - optional accounts can leverage anchor macros for PDA init/verification
    //      - ctx.remaining_accounts can be used to pass in any number of accounts
    //
    // https://github.com/coral-xyz/anchor/pull/2101 - anchor optional accounts PR
    // #[account(
    //     init,
    //     payer = payer,
    //     seeds = [
    //          whitelist_verifier.get_cpi_caller()?.as_ref(),
    //          b"accumulator".as_ref(),
    //          base_account.as_ref()
    //          &account_type.to_le_bytes(),
    //      ],
    //     bump,
    //     space = 8 + AccumulatorAccount::get_initial_size(&data[0])
    // )]
    // pub acc_input_0:          Option<Account<'info, AccumulatorInput>>,
}

impl<'info> CreateInputs<'info> {
    /// Creates and initializes an accumulator input PDA
    fn create_and_initialize_accumulator_input_pda<'a>(
        accumulator_input_ai: &AccountInfo<'a>,
        accumulator_input: AccumulatorInput,
        accumulator_input_size: usize,
        payer: &AccountInfo<'a>,
        seeds: &[&[&[u8]]],
        rent: &Rent,
        system_program: &AccountInfo<'a>,
    ) -> Result<()> {
        let lamports = rent.minimum_balance(accumulator_input_size);

        system_program::create_account(
            CpiContext::new_with_signer(
                system_program.to_account_info(),
                CreateAccount {
                    from: payer.to_account_info(),
                    to:   accumulator_input_ai.to_account_info(),
                },
                seeds,
            ),
            lamports,
            accumulator_input_size.try_into().unwrap(),
            &crate::ID,
        )?;

        AccountSerialize::try_serialize(
            &accumulator_input,
            &mut &mut accumulator_input_ai.data.borrow_mut()[..],
        )
        .map_err(|e| {
            msg!("original error: {:?}", e);
            AccumulatorUpdaterError::SerializeError
        })?;
        // msg!("accumulator_input_ai: {:#?}", accumulator_input_ai);

        Ok(())
    }
}
