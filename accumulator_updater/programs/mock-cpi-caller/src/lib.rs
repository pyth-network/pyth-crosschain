use {
    accumulator_updater::{
        cpi::accounts as AccumulatorUpdaterCpiAccts,
        program::AccumulatorUpdater as AccumulatorUpdaterProgram,
    },
    anchor_lang::{
        prelude::*,
        solana_program::{
            instruction::Instruction,
            sysvar,
        },
    },
};

declare_id!("Dg5PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod mock_cpi_caller {
    use super::*;

    pub fn add_price<'info>(
        ctx: Context<'_, '_, '_, 'info, AddPrice<'info>>,
        params: AddPriceParams,
    ) -> Result<()> {
        let pyth_price_acct = &mut ctx.accounts.pyth_price_account;
        let AddPriceParams {
            id,
            price,
            price_expo,
            ema,
            ema_expo,
        } = params;
        pyth_price_acct.initialize(id, price, price_expo, ema, ema_expo)?;

        let mut cpi_ctx = CpiContext::new(
            ctx.accounts.accumulator_program.to_account_info(),
            AccumulatorUpdaterCpiAccts::AddAccount {
                payer:              ctx.accounts.payer.to_account_info(),
                whitelist_verifier: AccumulatorUpdaterCpiAccts::WhitelistVerifier {
                    whitelist:  ctx.accounts.accumulator_whitelist.to_account_info(),
                    ixs_sysvar: ctx.accounts.ixs_sysvar.to_account_info(),
                },
                system_program:     ctx.accounts.system_program.to_account_info(),
            },
        );

        cpi_ctx = cpi_ctx.with_remaining_accounts(ctx.remaining_accounts.to_vec());


        let mut price_account_data_vec = vec![];
        AccountSerialize::try_serialize(
            &pyth_price_acct.clone().into_inner(),
            &mut price_account_data_vec,
        )?;


        let price_only_data = PriceOnly::from(&pyth_price_acct.clone().into_inner())
            .try_to_vec()
            .unwrap();

        let account_data: Vec<Vec<u8>> = vec![price_account_data_vec, price_only_data];
        let account_schemas = vec![PythSchemas::Full, PythSchemas::Compact]
            .into_iter()
            .map(|s| s.to_u8())
            .collect::<Vec<u8>>();
        accumulator_updater::cpi::add_account(
            cpi_ctx,
            ctx.accounts.pyth_price_account.key(),
            account_data,
            PythAccountTypes::Price.to_u32(),
            account_schemas,
        )?;
        Ok(())
    }
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct AddPriceParams {
    pub id:         u64,
    pub price:      u64,
    pub price_expo: u64,
    pub ema:        u64,
    pub ema_expo:   u64,
}

#[derive(Copy, Clone)]
#[repr(u32)]
pub enum PythAccountTypes {
    Mapping     = 1,
    Product     = 2,
    Price       = 3,
    Test        = 4,
    Permissions = 5,
}
impl PythAccountTypes {
    fn to_u32(&self) -> u32 {
        *self as u32
    }
}

#[derive(Copy, Clone)]
#[repr(u8)]
pub enum PythSchemas {
    Full    = 0,
    Compact = 1,
    Minimal = 2,
}

impl PythSchemas {
    fn to_u8(&self) -> u8 {
        *self as u8
    }
}

pub fn invoke_add_account_cpi_solana(ctx: Context<AddPrice>) -> Result<()> {
    /*
    let wh_complete_native_with_payload_acct_infos = vec![
        self.payer.to_account_info().clone(),
        self.token_bridge_config.to_account_info().clone(),
        self.message.to_account_info().clone(),
        self.claim.to_account_info().clone(),
        self.endpoint.to_account_info().clone(),
        self.to.to_account_info().clone(),
        self.redeemer.to_account_info().clone(),
        self.fee_recipient.to_account_info().clone(),
        self.custody.to_account_info().clone(),
        self.swim_usd_mint.to_account_info().clone(),
        self.custody_signer.to_account_info().clone(),
        self.rent.to_account_info().clone(),
        self.system_program.to_account_info().clone(),
        self.wormhole.to_account_info().clone(),
        self.token_program.to_account_info().clone(),
    ];
    let complete_transfer_with_payload_ix = Instruction {
        program_id: self.token_bridge.key(),
        // accounts: ctx.accounts.to_account_metas(None),
        accounts: vec![
            AccountMeta::new(self.payer.key(), true),
            AccountMeta::new_readonly(self.token_bridge_config.key(), false),
            AccountMeta::new_readonly(self.message.key(), false),
            AccountMeta::new(self.claim.key(), false),
            AccountMeta::new_readonly(self.endpoint.key(), false),
            AccountMeta::new(self.to.key(), false),
            AccountMeta::new_readonly(self.redeemer.key(), true),
            AccountMeta::new(self.fee_recipient.key(), false),
            AccountMeta::new(self.custody.key(), false),
            AccountMeta::new_readonly(self.swim_usd_mint.key(), false),
            AccountMeta::new_readonly(self.custody_signer.key(), false),
            // Dependencies
            AccountMeta::new_readonly(Rent::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
            // Program
            AccountMeta::new_readonly(self.wormhole.key(), false),
            AccountMeta::new_readonly(spl_token::id(), false),
        ],
        data: (COMPLETE_NATIVE_WITH_PAYLOAD_INSTRUCTION, CompleteNativeWithPayloadData {}).try_to_vec()?,
    };
    invoke_signed(
        &complete_transfer_with_payload_ix,
        &wh_complete_native_with_payload_acct_infos,
        // &self.to_account_infos(),
        &[&[&b"redeemer".as_ref(), &[self.propeller.redeemer_bump]]],
    )?;
     */
    let _add_accumulator_accounts_ix = Instruction {
        program_id: ctx.accounts.accumulator_program.key(),
        accounts:   vec![],
        data:       vec![],
    };
    // invoke_signed(
    //
    // )
    Ok(())
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
    pub pyth_price_account:    Account<'info, PriceAccount>,
    #[account(mut)]
    pub payer:                 Signer<'info>,
    /// also needed for accumulator_updater
    pub system_program:        Program<'info, System>,
    /// CHECK: whitelist
    pub accumulator_whitelist: UncheckedAccount<'info>,
    /// CHECK: instructions introspection sysvar
    #[account(address = sysvar::instructions::ID)]
    pub ixs_sysvar:            UncheckedAccount<'info>,
    pub accumulator_program:   Program<'info, AccumulatorUpdaterProgram>,
    // Remaining Accounts
    // should all be new uninitialized accounts
}


//Note: this will use anchor's default borsh serialization schema with the header
#[account]
#[derive(InitSpace)]
pub struct PriceAccount {
    pub id:         u64,
    pub price:      u64,
    pub price_expo: u64,
    pub ema:        u64,
    pub ema_expo:   u64,
}

impl PriceAccount {
    fn initialize(
        &mut self,
        id: u64,
        price: u64,
        price_expo: u64,
        ema: u64,
        ema_expo: u64,
    ) -> Result<()> {
        self.id = id;
        self.price = price;
        self.price_expo = price_expo;
        self.ema = ema;
        self.ema_expo = ema_expo;
        Ok(())
    }
}

// #[derive(Default, Debug, borsh::BorshSerialize)]
#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct PriceOnly {
    pub price_expo: u64,
    pub price:      u64,
    pub id:         u64,
}

impl PriceOnly {
    fn serialize(&self) -> Vec<u8> {
        self.try_to_vec().unwrap()
    }

    fn serialize_from_price_account(other: PriceAccount) -> Vec<u8> {
        PriceOnly::from(&other).try_to_vec().unwrap()
    }
}


impl From<&PriceAccount> for PriceOnly {
    fn from(other: &PriceAccount) -> Self {
        Self {
            id:         other.id,
            price:      other.price,
            price_expo: other.price_expo,
        }
    }
}


impl From<PriceAccount> for PriceOnly {
    fn from(other: PriceAccount) -> Self {
        Self {
            id:         other.id,
            price:      other.price,
            price_expo: other.price_expo,
        }
    }
}
