use {
    crate::{MessageBufferError, MESSAGE, WHITELIST},
    anchor_lang::prelude::*,
};

// Note: purposely not making this zero_copy
// otherwise whitelist must always be marked mutable
// and majority of operations are read
#[account]
#[derive(InitSpace)]
pub struct Whitelist {
    pub bump: u8,
    pub admin: Pubkey,
    // This is used by the `#[derive(InitSpace)]`
    // to determine initial account size
    #[max_len(32)]
    pub allowed_programs: Vec<Pubkey>,
}

impl Whitelist {
    pub fn validate_programs(&self, allowed_programs: &[Pubkey]) -> Result<()> {
        require!(
            !self.allowed_programs.contains(&Pubkey::default()),
            MessageBufferError::InvalidAllowedProgram
        );
        require_gte!(
            32,
            allowed_programs.len(),
            MessageBufferError::MaximumAllowedProgramsExceeded
        );
        Ok(())
    }

    pub fn validate_new_admin(&self, new_admin: Pubkey) -> Result<()> {
        require_keys_neq!(new_admin, Pubkey::default());
        Ok(())
    }

    pub fn is_allowed_program_auth(&self, auth: &Pubkey) -> Result<()> {
        require!(
            self.allowed_programs.contains(auth),
            MessageBufferError::CallerNotAllowed
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct WhitelistVerifier<'info> {
    #[account(
        seeds = [MESSAGE.as_bytes(), WHITELIST.as_bytes()],
        bump = whitelist.bump,
    )]
    // Using a Box to move account from stack to heap
    pub whitelist: Box<Account<'info, Whitelist>>,
    /// PDA representing authorized cpi caller
    pub cpi_caller_auth: Signer<'info>,
}

impl<'info> WhitelistVerifier<'info> {
    pub fn is_allowed(&self) -> Result<()> {
        let auth = self.cpi_caller_auth.key();
        let whitelist = &self.whitelist;
        whitelist.is_allowed_program_auth(&auth)?;
        Ok(())
    }
}
