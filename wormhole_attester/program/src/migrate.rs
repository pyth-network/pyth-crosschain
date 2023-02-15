//! Instruction used to migrate on-chain configuration from an older format

use {
    crate::config::{
        OldP2WConfigAccount,
        OldPyth2WormholeConfig,
        P2WConfigAccount,
        Pyth2WormholeConfig,
    },
    solana_program::{
        program_error::ProgramError,
        system_program,
    },
    solitaire::{
        trace,
        AccountState,
        CreationLamports,
        ExecutionContext,
        FromAccounts,
        Info,
        Keyed,
        Mut,
        Peel,
        Result as SoliResult,
        Signer,
        SolitaireError,
    },
};

/// Migration accounts meant to evolve with subsequent config accounts
///
/// NOTE: This account struct assumes Solitaire is able to validate the
/// Uninitialized requirement on the new_config account
#[derive(FromAccounts)]
pub struct Migrate<'b> {
    /// New config account to be populated. Must be unused.
    pub new_config:     Mut<P2WConfigAccount<'b, { AccountState::Uninitialized }>>,
    /// Old config using the previous format.
    pub old_config:     Mut<OldP2WConfigAccount<'b>>,
    /// Current owner authority of the program
    pub current_owner:  Mut<Signer<Info<'b>>>,
    /// Payer account for updating the account data
    pub payer:          Mut<Signer<Info<'b>>>,
    /// For creating the new config account
    pub system_program: Info<'b>,
}

pub fn migrate(ctx: &ExecutionContext, accs: &mut Migrate, _data: ()) -> SoliResult<()> {
    let old_config: &OldPyth2WormholeConfig = &accs.old_config.1;

    if &old_config.owner != accs.current_owner.info().key {
        trace!(
            "Current config owner account mismatch (expected {:?})",
            old_config.owner
        );
        return Err(SolitaireError::InvalidSigner(
            *accs.current_owner.info().key,
        ));
    }

    if *accs.system_program.key != system_program::id() {
        trace!(
            "Invalid system program, expected {:?}), found {}",
            system_program::id(),
            accs.system_program.key
        );
        return Err(SolitaireError::InvalidSigner(*accs.system_program.key));
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
    let new_payer_balance = accs
        .payer
        .info()
        .lamports
        .borrow_mut()
        .checked_add(old_config_balance_val)
        .ok_or_else(|| {
            trace!("Overflow on payer balance increase");
            SolitaireError::ProgramError(ProgramError::Custom(0xDEADBEEF))
        })?;

    **accs.payer.info().lamports.borrow_mut() = new_payer_balance;

    Ok(())
}
