use {
    crate::AccumulatorUpdaterError,
    anchor_lang::prelude::*,
};

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
        seeds = [b"message".as_ref(), b"whitelist".as_ref()],
        bump = whitelist.bump,
    )]
    // Using a Box to move account from stack to heap
    pub whitelist: Box<Account<'info, Whitelist>>,
    /// PDA representing authorized cpi caller
    pub cpi_caller_auth: Signer<'info>,
}

impl<'info> WhitelistVerifier<'info> {
    pub fn is_allowed(&self) -> Result<Pubkey> {
        let auth = self.cpi_caller_auth.key();
        let whitelist = &self.whitelist;
        require!(
            whitelist.allowed_programs.contains(&auth),
            AccumulatorUpdaterError::CallerNotAllowed
        );
        Ok(auth)
    }
}
