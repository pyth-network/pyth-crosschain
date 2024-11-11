// We can't do much about the size of `anchor_lang::error::Error`.
#![allow(clippy::result_large_err)]

pub mod instructions;
mod state;

use {
    crate::{MESSAGE, WHITELIST},
    anchor_lang::prelude::*,
    instructions::*,
    state::*,
};

declare_id!("7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPb6JxDcffRHUM");

#[program]
pub mod message_buffer {
    use super::*;

    /// Initializes the whitelist and sets it's admin. Once initialized,
    /// the admin must sign all further changes to the whitelist.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        require_keys_neq!(ctx.accounts.admin.key(), Pubkey::default());
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.bump = *ctx.bumps.get("whitelist").unwrap();
        whitelist.admin = ctx.accounts.admin.key();
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
    pub fn resize_buffer<'info>(
        ctx: Context<'_, '_, '_, 'info, ResizeBuffer<'info>>,
        allowed_program_auth: Pubkey,
        base_account_key: Pubkey,
        target_size: u32,
    ) -> Result<()> {
        instructions::resize_buffer(ctx, allowed_program_auth, base_account_key, target_size)
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
    pub fn delete_buffer<'info>(
        ctx: Context<'_, '_, '_, 'info, DeleteBuffer<'info>>,
        allowed_program_auth: Pubkey,
        base_account_key: Pubkey,
    ) -> Result<()> {
        instructions::delete_buffer(ctx, allowed_program_auth, base_account_key)
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// Admin that can update the whitelist and create/resize/delete buffers
    pub admin: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        seeds = [MESSAGE.as_bytes(), WHITELIST.as_bytes()],
        bump,
        space = 8 + Whitelist::INIT_SPACE,
    )]
    pub whitelist: Account<'info, Whitelist>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateWhitelist<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [MESSAGE.as_bytes(), WHITELIST.as_bytes()],
        bump = whitelist.bump,
        has_one = admin
    )]
    pub whitelist: Account<'info, Whitelist>,
}

#[error_code]
pub enum MessageBufferError {
    #[msg("CPI Caller not allowed")]
    CallerNotAllowed,
    #[msg("Invalid allowed program")]
    InvalidAllowedProgram,
    #[msg("Maximum number of allowed programs exceeded")]
    MaximumAllowedProgramsExceeded,
    #[msg("Message Buffer not provided")]
    MessageBufferNotProvided,
    #[msg("Message Buffer target size is not sufficiently large")]
    MessageBufferTooSmall,
    #[msg("Target size too large for reallocation/initialization. Max delta is 10240")]
    TargetSizeDeltaExceeded,
    #[msg("Target size exceeds MessageBuffer::MAX_LEN")]
    TargetSizeExceedsMaxLen,
}
