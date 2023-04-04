use {
    accumulator_updater::{
        cpi::accounts as AccumulatorUpdaterCpiAccts,
        program::AccumulatorUpdater as AccumulatorUpdaterProgram,
    },
    anchor_lang::{
        prelude::*,
        solana_program::{
            hash::hashv,
            sysvar,
        },
    },
    message::{
        get_schemas,
        price::*,
        AccumulatorSerializer,
    },
};

pub mod message;
declare_id!("Dg5PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod mock_cpi_caller {
    use super::*;

    pub fn add_price<'info>(
        ctx: Context<'_, '_, '_, 'info, AddPrice<'info>>,
        params: AddPriceParams,
    ) -> Result<()> {
        let mut account_data: Vec<Vec<u8>> = vec![];
        let schemas = get_schemas(PythAccountType::Price);

        {
            let pyth_price_acct = &mut ctx.accounts.pyth_price_account.load_init()?;

            pyth_price_acct.init(params)?;

            let price_full_data =
                FullPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;

            account_data.push(price_full_data);


            let price_compact_data =
                CompactPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;
            account_data.push(price_compact_data);
        }


        let account_schemas = schemas.into_iter().map(|s| s.to_u8()).collect::<Vec<u8>>();

        // 44444 compute units
        // AddPrice::invoke_cpi_anchor(ctx, account_data, PythAccountType::Price, account_schemas)
        // 44045 compute units
        AddPrice::invoke_cpi_solana(ctx, account_data, PythAccountType::Price, account_schemas)
    }
}


impl<'info> AddPrice<'info> {
    fn create_inputs_ctx(
        &self,
        remaining_accounts: &[AccountInfo<'info>],
    ) -> CpiContext<'_, '_, '_, 'info, AccumulatorUpdaterCpiAccts::CreateInputs<'info>> {
        let mut cpi_ctx = CpiContext::new(
            self.accumulator_program.to_account_info(),
            AccumulatorUpdaterCpiAccts::CreateInputs {
                payer:              self.payer.to_account_info(),
                whitelist_verifier: AccumulatorUpdaterCpiAccts::WhitelistVerifier {
                    whitelist:  self.accumulator_whitelist.to_account_info(),
                    ixs_sysvar: self.ixs_sysvar.to_account_info(),
                },
                system_program:     self.system_program.to_account_info(),
            },
        );


        cpi_ctx = cpi_ctx.with_remaining_accounts(remaining_accounts.to_vec());
        cpi_ctx
    }

    /// invoke cpi call using anchor
    fn invoke_cpi_anchor(
        ctx: Context<'_, '_, '_, 'info, AddPrice<'info>>,
        account_data: Vec<Vec<u8>>,
        account_type: PythAccountType,
        account_schemas: Vec<u8>,
    ) -> Result<()> {
        accumulator_updater::cpi::create_inputs(
            ctx.accounts.create_inputs_ctx(ctx.remaining_accounts),
            ctx.accounts.pyth_price_account.key(),
            account_data,
            account_type.to_u32(),
            account_schemas,
        )?;
        Ok(())
    }


    /// invoke cpi call using solana
    fn invoke_cpi_solana(
        ctx: Context<'_, '_, '_, 'info, AddPrice<'info>>,
        account_data: Vec<Vec<u8>>,
        account_type: PythAccountType,
        account_schemas: Vec<u8>,
    ) -> Result<()> {
        let mut accounts = vec![
            AccountMeta::new(ctx.accounts.payer.key(), true),
            AccountMeta::new_readonly(ctx.accounts.accumulator_whitelist.key(), false),
            AccountMeta::new_readonly(ctx.accounts.ixs_sysvar.key(), false),
            AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
        ];
        accounts.extend_from_slice(
            &ctx.remaining_accounts
                .iter()
                .map(|a| AccountMeta::new(a.key(), false))
                .collect::<Vec<_>>(),
        );
        let create_inputs_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.accumulator_program.key(),
            accounts,
            data: (
                //anchor ix discriminator/identifier
                sighash("global", "create_inputs"),
                ctx.accounts.pyth_price_account.key(),
                account_data,
                account_type.to_u32(),
                account_schemas,
            )
                .try_to_vec()
                .unwrap(),
        };
        let account_infos = &mut ctx.accounts.to_account_infos();
        account_infos.extend_from_slice(ctx.remaining_accounts);
        anchor_lang::solana_program::program::invoke(&create_inputs_ix, account_infos)?;
        Ok(())
    }
}


/// Generate discriminator to be able to call anchor program's ix
/// * `namespace` - "global" for instructions
/// * `name` - name of ix to call CASE-SENSITIVE
pub fn sighash(namespace: &str, name: &str) -> [u8; 8] {
    let preimage = format!("{namespace}:{name}");

    let mut sighash = [0u8; 8];
    sighash.copy_from_slice(&hashv(&[preimage.as_bytes()]).to_bytes()[..8]);
    sighash
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct AddPriceParams {
    pub id:         u64,
    pub price:      u64,
    pub price_expo: u64,
    pub ema:        u64,
    pub ema_expo:   u64,
}

trait PythAccount {
    const ACCOUNT_TYPE: PythAccountType;
    fn account_type() -> PythAccountType {
        Self::ACCOUNT_TYPE
    }
}

#[derive(Copy, Clone)]
#[repr(u32)]
pub enum PythAccountType {
    Mapping     = 1,
    Product     = 2,
    Price       = 3,
    Test        = 4,
    Permissions = 5,
}
impl PythAccountType {
    fn to_u32(&self) -> u32 {
        *self as u32
    }
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
    pub pyth_price_account:    AccountLoader<'info, PriceAccount>,
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


#[account(zero_copy)]
#[derive(InitSpace)]
pub struct PriceAccount {
    pub id:         u64,
    pub price:      u64,
    pub price_expo: u64,
    pub ema:        u64,
    pub ema_expo:   u64,
    pub comp_:      [Pubkey; 32],
}

impl PriceAccount {
    fn init(&mut self, params: AddPriceParams) -> Result<()> {
        self.id = params.id;
        self.price = params.price;
        self.price_expo = params.price_expo;
        self.ema = params.ema;
        self.ema_expo = params.ema_expo;
        Ok(())
    }
}

impl PythAccount for PriceAccount {
    const ACCOUNT_TYPE: PythAccountType = PythAccountType::Price;
}


#[cfg(test)]
mod test {
    use {
        super::*,
        anchor_lang::InstructionData,
    };

    #[test]
    fn ix_discriminator() {
        let a = &(accumulator_updater::instruction::CreateInputs {
            base_account:    anchor_lang::prelude::Pubkey::default(),
            data:            vec![],
            account_type:    0,
            account_schemas: vec![],
        }
        .data()[..8]);

        let sighash = sighash("global", "create_inputs");
        println!(
            r"
            a: {a:?}
            sighash: {sighash:?}
            ",
        );
        assert_eq!(a, &sighash);
    }
}
