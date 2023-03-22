mod macros;

use anchor_lang::{
    prelude::*,
    solana_program::{
        program::invoke_signed,
        system_instruction,
        sysvar::{
            self,
            instructions::get_instruction_relative,
        },
    },
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod accumulator_updater {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.bump = *ctx.bumps.get("whitelist").unwrap();
        Ok(())
    }

    pub fn add_allowed_program(
        ctx: Context<AddAllowedProgram>,
        allowed_program: Pubkey,
    ) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        require_keys_neq!(allowed_program, Pubkey::default());
        require!(
            !whitelist.allowed_programs.contains(&allowed_program),
            AccumulatorUpdaterError::DuplicateAllowedProgram
        );
        whitelist.allowed_programs.push(allowed_program);
        Ok(())
    }

    /// Add new account(s) to be included in the accumulator
    pub fn add_account<'info>(
        ctx: Context<'_, '_, '_, 'info, AddAccount<'info>>,
        base_account: Pubkey,
        data: Vec<Vec<u8>>,
        account_type: u32,
        account_schemas: Vec<u8>,
    ) -> Result<()> {
        let cpi_caller = ctx.accounts.whitelist_verifier.is_allowed()?;
        require_eq!(data.len(), account_schemas.len());
        let accts = ctx.remaining_accounts;
        require_eq!(accts.len(), data.len());
        let mut zip = data.into_iter().zip(account_schemas.into_iter());

        for ai in accts {
            let (account_data, account_schema) = zip.next().unwrap();
            let seeds = accumulator_acc_seeds!(cpi_caller, base_account, account_schema);
            let (pda, bump) = Pubkey::find_program_address(seeds, &crate::ID);
            require_keys_eq!(ai.key(), pda);

            let accumulator_size = 8 + AccumulatorInput::get_initial_size(&account_data);
            let accumulator_account = AccumulatorInput {
                header: AccumulatorHeader {
                    version: 1, // from cpi caller?
                    account_type,
                    account_schema,
                },
                data:   account_data,
            };
            create_and_initialize_accumulator_account_pda(
                ai,
                accumulator_account,
                accumulator_size,
                &ctx.accounts.payer,
                &[accumulator_acc_seeds_with_bump!(
                    cpi_caller,
                    base_account,
                    account_schema,
                    bump
                )],
                &ctx.accounts.system_program,
            )?;
        }

        Ok(())
    }
}

fn create_and_initialize_accumulator_account_pda<'a>(
    accumulator_input_ai: &AccountInfo<'a>,
    accumulator_input: AccumulatorInput,
    accumulator_input_size: usize,
    payer: &AccountInfo<'a>,
    seeds: &[&[&[u8]]],
    system_program: &AccountInfo<'a>,
) -> Result<()> {
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(accumulator_input_size);
    let create_pda_ix = &system_instruction::create_account(
        payer.key,
        accumulator_input_ai.key,
        lamports,
        accumulator_input_size.try_into().unwrap(),
        &crate::ID,
    );

    invoke_signed(
        create_pda_ix,
        &[
            payer.clone(),
            accumulator_input_ai.clone(),
            system_program.clone(),
        ],
        seeds,
    )?;


    AccountSerialize::try_serialize(
        &accumulator_input,
        &mut &mut accumulator_input_ai.data.borrow_mut()[..],
    )
    .map_err(|e| {
        msg!("original error: {:?}", e);
        AccumulatorUpdaterError::SerializeError
    })?;
    msg!("accumulator_input_ai: {:#?}", accumulator_input_ai);

    Ok(())
}


// Note: purposely not making this zero_copy
// otherwise whitelist must always be marked mutable
// and majority of operations are read
#[account]
#[derive(InitSpace)]
pub struct Whitelist {
    pub bump:             u8,
    #[max_len(32)]
    pub allowed_programs: Vec<Pubkey>,
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
pub struct AddAllowedProgram<'info> {
    #[account(mut)]
    pub payer:          Signer<'info>,
    #[account(
    mut,
    seeds = [b"accumulator".as_ref(), b"whitelist".as_ref()],
    bump = whitelist.bump,
    )]
    pub whitelist:      Account<'info, Whitelist>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(base_account: Pubkey, data: Vec<Vec<u8>>, account_type: u32)] // only needed if using optional accounts
pub struct AddAccount<'info> {
    #[account(mut)]
    pub payer:              Signer<'info>,
    pub whitelist_verifier: WhitelistVerifier<'info>,
    pub system_program:     Program<'info, System>,
    //TODO: decide on using optional accounts vs ctx.remaining_accounts
    //      - optional accounts can leverage anchor macros for PDA init/verification
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

#[derive(Accounts)]
pub struct UpdateAccount<'info> {
    #[account(mut)]
    pub payer:              Signer<'info>,
    pub whitelist_verifier: WhitelistVerifier<'info>,
}

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
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct AccumulatorHeader {
    pub version:        u8,
    // u32 for parity with pyth oracle contract
    pub account_type:   u32,
    pub account_schema: u8,
}

impl AccumulatorHeader {
    pub const SIZE: usize = 1 + 4 + 1;
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
}
