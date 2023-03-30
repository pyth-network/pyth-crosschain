mod macros;

use anchor_lang::{
    prelude::*,
    solana_program::sysvar::{
        self,
        instructions::get_instruction_relative,
    },
    system_program::{
        self,
        CreateAccount,
    },
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod accumulator_updater {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()> {
        require_keys_neq!(authority, Pubkey::default());
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.bump = *ctx.bumps.get("whitelist").unwrap();
        whitelist.authority = authority;
        Ok(())
    }

    pub fn set_allowed_programs(
        ctx: Context<UpdateWhitelist>,
        allowed_programs: Vec<Pubkey>,
    ) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.validate_programs(&allowed_programs)?;
        whitelist.allowed_programs = allowed_programs;
        Ok(())
    }

    pub fn update_whitelist_authority(
        ctx: Context<UpdateWhitelist>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.validate_new_authority(new_authority)?;
        whitelist.authority = new_authority;
        Ok(())
    }

    /// Add new account(s) to be included in the accumulator
    ///
    /// * `base_account` - Pubkey of the original account the AccumulatorInput(s) are derived from
    /// * `data` - Vec of AccumulatorInput account data
    /// * `account_type` - Marker to indicate base_account account_type
    /// * `account_schemas` - Vec of markers to indicate schemas for AccumulatorInputs. In same respective
    ///    order as data
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
}


// Note: purposely not making this zero_copy
// otherwise whitelist must always be marked mutable
// and majority of operations are read
#[account]
#[derive(InitSpace)]
pub struct Whitelist {
    pub bump:             u8,
    pub authority:        Pubkey,
    #[max_len(32)]
    pub allowed_programs: Vec<Pubkey>,
}

impl Whitelist {
    pub fn validate_programs(&self, allowed_programs: &[Pubkey]) -> Result<()> {
        require!(
            !self.allowed_programs.contains(&Pubkey::default()),
            AccumulatorUpdaterError::InvalidAllowedProgram
        );
        require_gte!(
            32,
            allowed_programs.len(),
            AccumulatorUpdaterError::MaximumAllowedProgramsExceeded
        );
        Ok(())
    }

    pub fn validate_new_authority(&self, new_authority: Pubkey) -> Result<()> {
        require_keys_neq!(new_authority, Pubkey::default());
        Ok(())
    }
}


#[derive(Accounts)]
pub struct WhitelistVerifier<'info> {
    #[account(
        seeds = [b"accumulator".as_ref(), b"whitelist".as_ref()],
        bump = whitelist.bump,
    )]
    pub whitelist:  Account<'info, Whitelist>,
    /// CHECK: Instruction introspection sysvar
    #[account(address = sysvar::instructions::ID)]
    pub ixs_sysvar: UncheckedAccount<'info>,
}

impl<'info> WhitelistVerifier<'info> {
    pub fn get_cpi_caller(&self) -> Result<Pubkey> {
        let instruction = get_instruction_relative(0, &self.ixs_sysvar.to_account_info())?;
        Ok(instruction.program_id)
    }
    pub fn is_allowed(&self) -> Result<Pubkey> {
        let cpi_caller = self.get_cpi_caller()?;
        let whitelist = &self.whitelist;
        require!(
            whitelist.allowed_programs.contains(&cpi_caller),
            AccumulatorUpdaterError::CallerNotAllowed
        );
        Ok(cpi_caller)
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer:          Signer<'info>,
    #[account(
        init,
        payer = payer,
        seeds = [b"accumulator".as_ref(), b"whitelist".as_ref()],
        bump,
        space = 8 + Whitelist::INIT_SPACE
    )]
    pub whitelist:      Account<'info, Whitelist>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct UpdateWhitelist<'info> {
    #[account(mut)]
    pub payer:     Signer<'info>,
    pub authority: Signer<'info>,
    #[account(
    mut,
    seeds = [b"accumulator".as_ref(), b"whitelist".as_ref()],
    bump = whitelist.bump,
    has_one = authority,
    )]
    pub whitelist: Account<'info, Whitelist>,
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

// TODO: should UpdateInput be allowed to resize an AccumulatorInput account?
#[derive(Accounts)]
pub struct UpdateInputs<'info> {
    #[account(mut)]
    pub payer:              Signer<'info>,
    pub whitelist_verifier: WhitelistVerifier<'info>,
}

//TODO: implement custom serialization & set alignment
#[account]
pub struct AccumulatorInput {
    pub header: AccumulatorHeader,
    //TODO: Vec<u8> for resizing?
    pub data:   Vec<u8>,
}

impl AccumulatorInput {
    pub fn get_initial_size(data: &Vec<u8>) -> usize {
        AccumulatorHeader::SIZE + 4 + data.len()
    }

    pub fn new(header: AccumulatorHeader, data: Vec<u8>) -> Self {
        Self { header, data }
    }
}

//TODO:
// - implement custom serialization & set alignment
// - what other fields are needed?
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct AccumulatorHeader {
    pub version:        u8,
    // u32 for parity with pyth oracle contract
    pub account_type:   u32,
    pub account_schema: u8,
}


impl AccumulatorHeader {
    pub const SIZE: usize = 1 + 4 + 1;

    pub fn new(version: u8, account_type: u32, account_schema: u8) -> Self {
        Self {
            version,
            account_type,
            account_schema,
        }
    }
}

#[error_code]
pub enum AccumulatorUpdaterError {
    #[msg("CPI Caller not allowed")]
    CallerNotAllowed,
    #[msg("Whitelist already contains program")]
    DuplicateAllowedProgram,
    #[msg("Conversion Error")]
    ConversionError,
    #[msg("Serialization Error")]
    SerializeError,
    #[msg("Whitelist admin required on initialization")]
    WhitelistAdminRequired,
    #[msg("Invalid allowed program")]
    InvalidAllowedProgram,
    #[msg("Maximum number of allowed programs exceeded")]
    MaximumAllowedProgramsExceeded,
}
