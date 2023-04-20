use {
    crate::AccumulatorUpdaterError,
    anchor_lang::{
        prelude::*,
        solana_program::sysvar::{
            self,
            instructions::get_instruction_relative,
        },
    },
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
        seeds = [b"accumulator".as_ref(), b"whitelist".as_ref()],
        bump = whitelist.bump,
    )]
    // Using a Box to move account from stack to heap
    pub whitelist: Box<Account<'info, Whitelist>>,
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
