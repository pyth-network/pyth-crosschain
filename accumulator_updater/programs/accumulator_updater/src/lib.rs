mod instructions;
mod macros;
mod state;


use {
    anchor_lang::prelude::*,
    instructions::*,
    state::*,
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod accumulator_updater {
    use super::*;


    /// Initializes the whitelist and sets it's authority to the provided pubkey
    /// Once initialized, the authority must sign all further changes to the whitelist.
    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()> {
        require_keys_neq!(authority, Pubkey::default());
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.bump = *ctx.bumps.get("whitelist").unwrap();
        whitelist.authority = authority;
        Ok(())
    }

    /// Sets the programs that are allowed to invoke this program through CPI
    ///
    /// * `allowed_programs` - Entire list of programs that are allowed to
    ///                       invoke this program through CPI
    pub fn set_allowed_programs(
        ctx: Context<UpdateWhitelist>,
        allowed_programs: Vec<Pubkey>,
    ) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.validate_programs(&allowed_programs)?;
        whitelist.allowed_programs = allowed_programs;
        Ok(())
    }

    /// Sets the new authority for the whitelist
    pub fn update_whitelist_authority(
        ctx: Context<UpdateWhitelist>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.validate_new_authority(new_authority)?;
        whitelist.authority = new_authority;
        Ok(())
    }


    /// Create or update inputs for the Accumulator. Each input is written
    /// into a separate PDA account derived with
    /// seeds = [cpi_caller, b"accumulator", base_account_key, schema]
    ///
    /// The caller of this instruction must pass those PDAs
    /// while calling this function in the same order as elements.
    ///
    ///
    /// * `base_account_key`    - Pubkey of the original account the
    ///                         AccumulatorInput(s) are derived from
    /// * `values`              - Vec of (schema, account_data) in same respective
    ///                           order `ctx.remaining_accounts`
    pub fn put_all<'info>(
        ctx: Context<'_, '_, '_, 'info, PutAll<'info>>,
        base_account_key: Pubkey,
        values: Vec<InputSchemaAndData>,
    ) -> Result<()> {
        instructions::put_all(ctx, base_account_key, values)
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

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
    pub payer: Signer<'info>,

    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"accumulator".as_ref(), b"whitelist".as_ref()],
        bump = whitelist.bump,
        has_one = authority
    )]
    pub whitelist: Account<'info, Whitelist>,
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
    #[msg("Invalid PDA")]
    InvalidPDA,
    #[msg("Update data exceeds current length")]
    CurrentDataLengthExceeded,
    #[msg("Accumulator Input not writable")]
    AccumulatorInputNotWritable,
    #[msg("Accumulator Input not provided")]
    AccumulatorInputNotProvided,
}
