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


pub fn put_all<'info>(
    ctx: Context<'_, '_, '_, 'info, PutAll<'info>>,
    base_account_key: Pubkey,
    messages: Vec<Vec<u8>>,
) -> Result<()> {
    let cpi_caller_auth = ctx.accounts.whitelist_verifier.is_allowed()?;
    let accumulator_input_ai = ctx
        .remaining_accounts
        .first()
        .ok_or(AccumulatorUpdaterError::MessageBufferNotProvided)?;

    /*
        let loader;

    // TODO: use MessageHeader here
    let account_data = accumulator_input_ai.try_borrow_mut_data()?;
    let header = bytemuck::from_bytes_mut(&mut account_data.deref_mut()[8..mem::size_of::<BufferHeader>() + 8]);
    let message_region = [mem::size_of::<BufferHeader>() + 8..];

    loader = AccountLoader::<BufferHeader>::try_from(accumulator_input_ai)?;
    let mut accumulator_input = loader.load_mut()?;
    accumulator_input.header.set_version();
    accumulator_input

    accumulator_input_ai.data.


        // note: redundant for uninitialized code path but safer to check here.
        // compute budget cost should be minimal
        accumulator_input.validate(
            accumulator_input_ai.key(),
            cpi_caller_auth,
            base_account_key,
        )?;


    let (num_msgs, num_bytes) = accumulator_input.put_all(&messages);
    if num_msgs != messages.len() {
        msg!("unable to fit all messages in accumulator input account. Wrote {}/{} messages and {} bytes", num_msgs, messages.len(), num_bytes);
    }

    loader.exit(&crate::ID)?;
     */

    Ok(())
}

pub fn is_uninitialized_account(ai: &AccountInfo) -> bool {
    ai.data_is_empty() && ai.owner == &system_program::ID
}


#[derive(Accounts)]
#[instruction( base_account_key: Pubkey)]
pub struct PutAll<'info> {
    /// `Fund` is a system account that holds
    /// the lamports that will be used to fund
    /// `AccumulatorInput` account initialization
    #[account(
        mut,
        seeds = [b"fund".as_ref()],
        owner = system_program::System::id(),
        bump,
    )]
    pub fund:               SystemAccount<'info>,
    pub whitelist_verifier: WhitelistVerifier<'info>,
    pub system_program:     Program<'info, System>,
    // remaining_accounts:  - [AccumulatorInput PDA]
}


impl<'info> PutAll<'info> {
    fn create_account<'a>(
        account_info: &AccountInfo<'a>,
        space: usize,
        payer: &AccountInfo<'a>,
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
