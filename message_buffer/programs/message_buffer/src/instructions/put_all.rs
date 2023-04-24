use {
    crate::{
        state::*,
        MessageBufferError,
    },
    anchor_lang::{
        prelude::*,
        system_program::{
            self,
            CreateAccount,
        },
    },
    std::{
        cell::RefMut,
        mem,
        ops::DerefMut,
    },
};


pub fn put_all<'info>(
    ctx: Context<'_, '_, '_, 'info, PutAll<'info>>,
    base_account_key: Pubkey,
    messages: Vec<Vec<u8>>,
) -> Result<()> {
    let cpi_caller_auth = ctx.accounts.whitelist_verifier.is_allowed()?;
    let message_buffer_account_info = ctx
        .remaining_accounts
        .first()
        .ok_or(MessageBufferError::MessageBufferNotProvided)?;


    let account_data = &mut message_buffer_account_info.try_borrow_mut_data()?;
    let header_end_index = mem::size_of::<MessageBuffer>() + 8;
    let (header_bytes, body_bytes) = account_data.split_at_mut(header_end_index);

    let header: &mut MessageBuffer = bytemuck::from_bytes_mut(&mut header_bytes[8..]);

    header.validate(
        message_buffer_account_info.key(),
        cpi_caller_auth,
        base_account_key,
    )?;

    header.refresh();

    let (num_msgs, num_bytes) = header.put_all_in_buffer(body_bytes, &messages);

    if num_msgs != messages.len() {
        msg!("unable to fit all messages in accumulator input account. Wrote {}/{} messages and {} bytes", num_msgs, messages.len(), num_bytes);
    }

    Ok(())
}

pub fn is_uninitialized_account(ai: &AccountInfo) -> bool {
    ai.data_is_empty() && ai.owner == &system_program::ID
}


#[derive(Accounts)]
#[instruction( base_account_key: Pubkey)]
pub struct PutAll<'info> {
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
