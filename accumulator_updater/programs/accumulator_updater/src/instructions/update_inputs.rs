use {
    crate::{
        state::*,
        AccumulatorUpdaterError,
    },
    anchor_lang::prelude::*,
};

pub fn update_inputs<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdateInputs<'info>>,
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


    for ai in accts {
        require!(
            ai.is_writable,
            AccumulatorUpdaterError::AccumulatorInputNotWritable
        );
        let (account_data, account_schema) = zip.next().unwrap();

        let mut accumulator_input = <AccumulatorInput as AccountDeserialize>::try_deserialize(
            // &mut &ai.data.borrow_mut()[..],
            &mut &**ai.try_borrow_mut_data()?,
        )?;
        {
            // TODO: allow re-sizing?
            require_gte!(
                accumulator_input.data.len(),
                account_data.len(),
                AccumulatorUpdaterError::CurrentDataLengthExceeded
            );

            AccumulatorInput::validate_account_info(
                ai.key(),
                &accumulator_input,
                cpi_caller,
                base_account,
                account_type,
                account_schema,
            )?;
        }
        accumulator_input.data = account_data;
        AccountSerialize::try_serialize(&accumulator_input, &mut &mut ai.data.borrow_mut()[..])
            .map_err(|e| {
                msg!("original error: {:?}", e);
                AccumulatorUpdaterError::SerializeError
            })?;
    }

    Ok(())
}

// TODO: should UpdateInput be allowed to resize an AccumulatorInput account?
#[derive(Accounts)]
pub struct UpdateInputs<'info> {
    #[account(mut)]
    pub payer:              Signer<'info>,
    pub whitelist_verifier: WhitelistVerifier<'info>,
}
