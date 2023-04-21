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
pub mod message_buffer {
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


    /// Insert messages/inputs for the Accumulator. All inputs derived from the
    /// `base_account_key` will go into the same PDA. The PDA is derived with
    /// seeds = [cpi_caller_auth, b"accumulator", base_account_key]
    ///
    ///
    ///
    /// * `base_account_key`    - Pubkey of the original account the
    ///                           `MessageBuffer` is derived from
    ///                           (e.g. pyth price account)
    /// * `messages`            - Vec of vec of bytes, each representing a message
    ///                           to be hashed and accumulated
    ///
    /// This ix will write as many of the messages up to the length
    /// of the `accumulator_input.data`.
    /// If `accumulator_input.data.len() < messages.map(|x| x.len()).sum()`
    /// then the remaining messages will be ignored.
    ///
    /// The current implementation assumes that each invocation of this
    /// ix is independent of any previous invocations. It will overwrite
    /// any existing contents.
    ///
    /// TODO:
    ///     - try handling re-allocation of the accumulator_input space
    ///     - handle updates ("paging/batches of messages")
    ///
    pub fn put_all<'info>(
        ctx: Context<'_, '_, '_, 'info, PutAll<'info>>,
        base_account_key: Pubkey,
        messages: Vec<Vec<u8>>,
    ) -> Result<()> {
        instructions::put_all(ctx, base_account_key, messages)
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
    #[msg("Message Buffer not provided")]
    MessageBufferNotProvided,
    #[msg("Fund Bump not found")]
    FundBumpNotFound,
}
