//! Instruction used to migrate on-chain configuration from an older format

use solana_program::{
    program_error::ProgramError,
    pubkey::Pubkey,
};

use solitaire::{
    trace,
    AccountState,
    CreationLamports,
    ExecutionContext,
    FromAccounts,
    Info,
    InstructionContext,
    Keyed,
    Mut,
    Peel,
    Result as SoliResult,
    Signer,
    SolitaireError,
    ToInstruction,
};

use crate::config::{
    OldP2WConfigAccount,
    OldPyth2WormholeConfig,
    P2WConfigAccount,
    Pyth2WormholeConfig,
};

/// Migration accounts meant to evolve with subsequent config accounts
///
/// NOTE: This account struct assumes Solitaire is able to validate the
/// Uninitialized requirement on the new_config account
#[derive(FromAccounts, ToInstruction)]
pub struct Migrate<'b> {
    /// New config account to be populated. Must be unused.
    pub new_config: Mut<P2WConfigAccount<'b, { AccountState::Uninitialized }>>,
    /// Old config using the previous format.
    pub old_config: OldP2WConfigAccount<'b>,
    /// Current owner authority of the program
    pub current_owner: Mut<Signer<Info<'b>>>,
    /// Payer account for updating the account data
    pub payer: Mut<Signer<Info<'b>>>,
}

impl<'b> InstructionContext<'b> for Migrate<'b> {
    fn deps(&self) -> Vec<Pubkey> {
        vec![]
    }
}

pub fn migrate(ctx: &ExecutionContext, accs: &mut Migrate, data: ()) -> SoliResult<()> {
    let old_config: &OldPyth2WormholeConfig = &accs.old_config.1;

    if &old_config.owner != accs.current_owner.info().key {
        trace!(
            "Current config owner account mismatch (expected {:?})",
            old_config.owner
        );
        return Err(SolitaireError::InvalidSigner(
            accs.current_owner.info().key.clone(),
        ));
    }

    // Populate new config
    accs.new_config
        .create(ctx, accs.payer.info().key, CreationLamports::Exempt)?;
    accs.new_config.1 = Pyth2WormholeConfig::from(old_config.clone());

    // Reclaim old config lamports

    // Save current balance
    let old_config_balance_val: u64 = accs.old_config.info().lamports();

    // Drain old config
    **accs.old_config.info().lamports.borrow_mut() = 0;

    // Credit payer with saved balance
    accs.payer
        .info()
        .lamports
        .borrow_mut()
        .checked_add(old_config_balance_val)
        .ok_or_else(|| {
            trace!("Overflow on payer balance increase");
            SolitaireError::ProgramError(ProgramError::Custom(0xDEADBEEF))
        })?;

    Ok(())
}
