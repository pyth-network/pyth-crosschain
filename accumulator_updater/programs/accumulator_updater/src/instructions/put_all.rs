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

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InputSchemaAndData {
    pub schema: u8,
    pub data:   Vec<u8>,
}


pub fn put_all<'info>(
    ctx: Context<'_, '_, '_, 'info, PutAll<'info>>,
    base_account_key: Pubkey,
    values: Vec<InputSchemaAndData>,
) -> Result<()> {
    let cpi_caller = ctx.accounts.whitelist_verifier.is_allowed()?;
    let account_infos = ctx.remaining_accounts;
    require_eq!(account_infos.len(), values.len());

    let rent = Rent::get()?;
    let (mut initialized, mut updated) = (vec![], vec![]);

    for (
        ai,
        InputSchemaAndData {
            schema: account_schema,
            data: account_data,
        },
    ) in account_infos.iter().zip(values)
    {
        let bump = if is_uninitialized_account(ai) {
            let seeds = &[
                cpi_caller.as_ref(),
                b"accumulator".as_ref(),
                base_account_key.as_ref(),
                &account_schema.to_le_bytes(),
            ];
            let (pda, bump) = Pubkey::find_program_address(seeds, &crate::ID);
            require_keys_eq!(ai.key(), pda);


            //TODO: Update this with serialization logic
            // 8 for anchor discriminator
            let accumulator_size = 8 + AccumulatorInput::size(&account_data);
            PutAll::create_account(
                ai,
                accumulator_size,
                &ctx.accounts.payer,
                &[
                    cpi_caller.as_ref(),
                    b"accumulator".as_ref(),
                    base_account_key.as_ref(),
                    &account_schema.to_le_bytes(),
                    &[bump],
                ],
                &rent,
                &ctx.accounts.system_program,
            )?;
            initialized.push(ai.key());

            bump
        } else {
            let accumulator_input = <AccumulatorInput as AccountDeserialize>::try_deserialize(
                &mut &**ai.try_borrow_mut_data()?,
            )?;
            {
                // TODO: allow re-sizing?
                require_gte!(
                    accumulator_input.data.len(),
                    account_data.len(),
                    AccumulatorUpdaterError::CurrentDataLengthExceeded
                );

                accumulator_input.validate(
                    ai.key(),
                    cpi_caller,
                    base_account_key,
                    account_schema,
                )?;
            }


            updated.push(ai.key());
            accumulator_input.header.bump
        };

        let accumulator_input =
            AccumulatorInput::new(AccumulatorHeader::new(bump, account_schema), account_data);
        accumulator_input.persist(ai)?;
    }

    msg!(
        "[emit-updates]: initialized: {:?}, updated: {:?}",
        initialized,
        updated
    );
    Ok(())
}

pub fn is_uninitialized_account(ai: &AccountInfo) -> bool {
    ai.data_is_empty() && ai.owner == &system_program::ID
}

#[derive(Accounts)]
pub struct PutAll<'info> {
    #[account(mut)]
    pub payer:              Signer<'info>,
    pub whitelist_verifier: WhitelistVerifier<'info>,
    pub system_program:     Program<'info, System>,
    // remaining_accounts:  - [AccumulatorInput PDAs]
}

impl<'info> PutAll<'info> {
    fn create_account<'a>(
        account_info: &AccountInfo<'a>,
        space: usize,
        payer: &AccountInfo<'a>,
        seeds: &[&[u8]],
        rent: &Rent,
        system_program: &AccountInfo<'a>,
    ) -> Result<()> {
        let lamports = rent.minimum_balance(space);

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
