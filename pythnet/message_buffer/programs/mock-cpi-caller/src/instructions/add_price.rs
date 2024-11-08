use {
    crate::{
        instructions::{sighash, ACCUMULATOR_UPDATER_IX_NAME, UPD_PRICE_WRITE},
        message::{
            get_schemas,
            price::{CompactPriceMessage, FullPriceMessage},
            AccumulatorSerializer,
        },
        state::{PriceAccount, PythAccountType},
    },
    anchor_lang::{prelude::*, system_program},
    message_buffer::program::MessageBuffer as MessageBufferProgram,
};

pub fn add_price<'info>(
    ctx: Context<'_, '_, '_, 'info, AddPrice<'info>>,
    params: AddPriceParams,
) -> Result<()> {
    let mut inputs: Vec<Vec<u8>> = vec![];
    let _schemas = get_schemas(PythAccountType::Price);

    {
        let pyth_price_acct = &mut ctx.accounts.pyth_price_account.load_init()?;

        pyth_price_acct.init(params)?;

        let price_full_data = FullPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;

        inputs.push(price_full_data);

        let price_compact_data =
            CompactPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;
        inputs.push(price_compact_data);
    }

    // Note: normally pyth oracle add_price wouldn't call emit_accumulator_inputs
    // since add_price doesn't actually add/update any price data we would
    // want included in the accumulator anyways. This is just for testing
    AddPrice::emit_messages(ctx, inputs)
}

impl<'info> AddPrice<'info> {
    /// Invoke message_buffer::put_all ix cpi call using solana
    pub fn emit_messages(
        ctx: Context<'_, '_, '_, 'info, AddPrice<'info>>,
        inputs: Vec<Vec<u8>>,
    ) -> anchor_lang::Result<()> {
        let mut accounts = vec![
            AccountMeta::new_readonly(ctx.accounts.accumulator_whitelist.key(), false),
            AccountMeta::new_readonly(ctx.accounts.auth.key(), true),
        ];
        accounts.extend_from_slice(
            &ctx.remaining_accounts
                .iter()
                .map(|a| AccountMeta::new(a.key(), false))
                .collect::<Vec<_>>(),
        );
        let create_inputs_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.message_buffer_program.key(),
            accounts,
            data: (
                //anchor ix discriminator/identifier
                sighash("global", ACCUMULATOR_UPDATER_IX_NAME),
                ctx.accounts.pyth_price_account.key(),
                inputs,
            )
                .try_to_vec()
                .unwrap(),
        };
        let account_infos = &mut ctx.accounts.to_account_infos();
        account_infos.extend_from_slice(ctx.remaining_accounts);
        // using find_program_address here instead of ctx.bumps.get since
        // that won't be available in the oracle program
        let (_, bump) = Pubkey::find_program_address(
            &[
                UPD_PRICE_WRITE.as_bytes(),
                ctx.accounts.message_buffer_program.key().as_ref(),
            ],
            &crate::ID,
        );
        anchor_lang::solana_program::program::invoke_signed(
            &create_inputs_ix,
            account_infos,
            &[&[
                UPD_PRICE_WRITE.as_bytes(),
                ctx.accounts.message_buffer_program.key().as_ref(),
                &[bump],
            ]],
        )?;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct AddPriceParams {
    pub id: u64,
    pub price: u64,
    pub price_expo: u64,
    pub ema: u64,
    pub ema_expo: u64,
}

#[derive(Accounts)]
#[instruction(params: AddPriceParams)]
pub struct AddPrice<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [b"pyth".as_ref(), b"price".as_ref(), &params.id.to_le_bytes()],
        bump,
        space = 8 + PriceAccount::INIT_SPACE
    )]
    pub pyth_price_account: AccountLoader<'info, PriceAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// also needed for accumulator_updater
    pub system_program: Program<'info, System>,
    /// CHECK: whitelist
    pub accumulator_whitelist: UncheckedAccount<'info>,
    /// PDA representing this program's authority
    /// to call the accumulator program
    #[account(
        seeds = [b"upd_price_write".as_ref(), message_buffer_program.key().as_ref()],
        owner = system_program::System::id(),
        bump,
    )]
    pub auth: SystemAccount<'info>,
    pub message_buffer_program: Program<'info, MessageBufferProgram>,
    // Remaining Accounts
    // MessageBuffer PDA
}
