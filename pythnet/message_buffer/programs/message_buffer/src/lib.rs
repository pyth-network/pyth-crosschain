pub mod instructions;
mod macros;
mod state;


use {
    anchor_lang::prelude::*,
    instructions::*,
    state::*,
};

declare_id!("Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPb6JxDcffRHUM");

#[program]
pub mod message_buffer {
    use super::*;

    pub fn test(ctx: Context<Test>, admin: Pubkey) -> Result<()> {
        use anchor_lang::{
            prelude::*,
            system_program::{
                self,
                Transfer,
            },
        };
        msg!("in test");
        let (whitelist_pda, whitelist_bump) =
            Pubkey::find_program_address(&[b"message", b"whitelist"], &crate::ID);
        msg!("crate_id: {:?}", crate::ID);
        let payer_pk = ctx.accounts.payer.key();
        msg!("payer_pk: {:?}", payer_pk);
        msg!("admin: {:?}", admin);
        msg!(
            "whitelist_pda: {:?}, whitelist_bump: {:?}",
            whitelist_pda,
            whitelist_bump
        );
        let whitelist_acct_pk = ctx.accounts.whitelist.key();
        msg!("whitelist_acct_pk: {:?}", whitelist_acct_pk);

        // let whitelist = &mut ctx.accounts.whitelist;
        // whitelist.bump = w_bump;

        // let whitelist_bump = *ctx.bumps.get("whitelist").unwrap();
        // msg!("whitelist_bump: {:?}", whitelist_bump);
        // whitelist.admin = Pubkey::default();
        // let init = &mut ctx.accounts.init;
        // init.bump = *ctx.bumps.get("init").unwrap();
        // msg!("[test]: initialized init");
        let system_prog = ctx.accounts.system_program.key();
        msg!("system_prog: {:?}", system_prog);
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to:   ctx.accounts.whitelist.to_account_info(),
                },
            ),
            Rent::get()?.minimum_balance(0),
        )?;
        msg!("transferred to payer");
        Ok(())
    }

    /// Initializes the whitelist and sets it's admin to the provided pubkey
    /// Once initialized, the authority must sign all further changes to the whitelist.
    pub fn initialize(ctx: Context<Initialize>, admin: Pubkey) -> Result<()> {
        require_keys_neq!(admin, Pubkey::default());
        msg!("in initialize");
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.bump = *ctx.bumps.get("whitelist").unwrap();
        // whitelist.bump = bump;
        whitelist.admin = admin;
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

    /// Sets the new admin for the whitelist
    pub fn update_whitelist_admin(ctx: Context<UpdateWhitelist>, new_admin: Pubkey) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.validate_new_admin(new_admin)?;
        whitelist.admin = new_admin;
        Ok(())
    }


    /// Put messages into the Accumulator. All messages put for the same
    /// `base_account_key` go into the same buffer PDA. The PDA's address is
    /// `[allowed_program_auth, MESSAGE, base_account_key]`, where `allowed_program_auth`
    /// is the whitelisted pubkey who authorized this call.
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
    ///     - handle updates ("paging/batches of messages")
    ///
    pub fn put_all<'info>(
        ctx: Context<'_, '_, '_, 'info, PutAll<'info>>,
        base_account_key: Pubkey,
        messages: Vec<Vec<u8>>,
    ) -> Result<()> {
        instructions::put_all(ctx, base_account_key, messages)
    }


    /// Initializes the buffer account with the `target_size`
    ///
    /// *`allowed_program_auth` - The whitelisted pubkey representing an
    ///                            allowed program. Used as one of the seeds
    ///                            for deriving the `MessageBuffer` PDA.
    /// * `base_account_key`    - Pubkey of the original account the
    ///                           `MessageBuffer` is derived from
    ///                           (e.g. pyth price account)
    /// *`target_size`          - Initial size to allocate for the
    ///                           `MessageBuffer` PDA. `target_size`
    ///                           must be >= HEADER_LEN && <= 10240
    pub fn create_buffer<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateBuffer<'info>>,
        allowed_program_auth: Pubkey,
        base_account_key: Pubkey,
        target_size: u32,
    ) -> Result<()> {
        instructions::create_buffer(ctx, allowed_program_auth, base_account_key, target_size)
    }

    /// Resizes the buffer account to the `target_size`
    ///
    /// *`allowed_program_auth` - The whitelisted pubkey representing an
    ///                            allowed program. Used as one of the seeds
    ///                            for deriving the `MessageBuffer` PDA.
    /// * `base_account_key`    - Pubkey of the original account the
    ///                           `MessageBuffer` is derived from
    ///                           (e.g. pyth price account)
    /// *`target_size`          -  Size to re-allocate for the
    ///                           `MessageBuffer` PDA. If increasing the size,
    ///                           max delta of current_size & target_size is 10240
    /// *`buffer_bump`          -  Bump seed for the `MessageBuffer` PDA
    pub fn resize_buffer<'info>(
        ctx: Context<'_, '_, '_, 'info, ResizeBuffer<'info>>,
        allowed_program_auth: Pubkey,
        base_account_key: Pubkey,
        buffer_bump: u8,
        target_size: u32,
    ) -> Result<()> {
        instructions::resize_buffer(
            ctx,
            allowed_program_auth,
            base_account_key,
            buffer_bump,
            target_size,
        )
    }

    /// Closes the buffer account and transfers the remaining lamports to the
    /// `admin` account
    ///
    /// *`allowed_program_auth` - The whitelisted pubkey representing an
    ///                            allowed program. Used as one of the seeds
    ///                            for deriving the `MessageBuffer` PDA.
    /// * `base_account_key`    - Pubkey of the original account the
    ///                           `MessageBuffer` is derived from
    ///                           (e.g. pyth price account)
    /// *`buffer_bump`          -  Bump seed for the `MessageBuffer` PDA
    pub fn delete_buffer<'info>(
        ctx: Context<'_, '_, '_, 'info, DeleteBuffer<'info>>,
        allowed_program_auth: Pubkey,
        base_account_key: Pubkey,
        buffer_bump: u8,
    ) -> Result<()> {
        instructions::delete_buffer(ctx, allowed_program_auth, base_account_key, buffer_bump)
    }
}

#[derive(Accounts)]
pub struct Test<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    // #[account(
    // init,
    // payer = payer,
    // seeds = [b"message".as_ref(), b"whitelist".as_ref()],
    // bump,
    // space = 8 + Whitelist::INIT_SPACE,
    // )]
    // pub whitelist:      Account<'info, Whitelist>,
    #[account(
    seeds = [b"message".as_ref(), b"whitelist".as_ref()],
    bump,
    )]
    /// CHECK: test
    pub whitelist:      UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    // #[account(
    // init,
    // payer = payer,
    // seeds = [b"message".as_ref(), b"init".as_ref()],
    // bump,
    // space = 8,
    // )]
    // pub init:           Account<'info, Init>,
}

#[account]
pub struct Init {
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer:          Signer<'info>,
    #[account(
        init,
        payer = payer,
        seeds = [b"message".as_ref(), b"whitelist".as_ref()],
        bump,
        space = 8 + Whitelist::INIT_SPACE,
    )]
    pub whitelist:      Account<'info, Whitelist>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct UpdateWhitelist<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub admin:     Signer<'info>,
    #[account(
        mut,
        seeds = [b"message".as_ref(), b"whitelist".as_ref()],
        bump = whitelist.bump,
        has_one = admin
    )]
    pub whitelist: Account<'info, Whitelist>,
}


#[error_code]
pub enum MessageBufferError {
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
    #[msg("Message Buffer is not sufficiently large")]
    MessageBufferTooSmall,
    #[msg("Fund Bump not found")]
    FundBumpNotFound,
    #[msg("Reallocation failed")]
    ReallocFailed,
    #[msg("Target size too large for reallocation/initialization. Max delta is 10240")]
    TargetSizeDeltaExceeded,
    #[msg("MessageBuffer Uninitialized")]
    MessageBufferUninitialized,
}
