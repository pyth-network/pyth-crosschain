use {
    crate::config::{
        P2WConfigAccount,
        Pyth2WormholeConfig,
    },
    solitaire::{
        trace,
        AccountState,
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

#[derive(FromAccounts)]
pub struct SetIsActive<'b> {
    /// Current config used by the program
    pub config:    Mut<P2WConfigAccount<'b, { AccountState::Initialized }>>,
    /// Current owner authority of the program
    pub ops_owner: Mut<Signer<Info<'b>>>,
    /// Payer account for updating the account data
    pub payer:     Mut<Signer<Info<'b>>>,
}

/// Alters the current settings of pyth2wormhole
pub fn set_is_active(
    _ctx: &ExecutionContext,
    accs: &mut SetIsActive,
    new_is_active: bool,
) -> SoliResult<()> {
    let cfg_struct: &mut Pyth2WormholeConfig = &mut accs.config; // unpack Data via nested Deref impls
    match &cfg_struct.ops_owner {
        None => Err(SolitaireError::InvalidOwner(*accs.ops_owner.info().key)),
        Some(current_ops_owner) => {
            if current_ops_owner != accs.ops_owner.info().key {
                trace!(
                    "Ops owner account mismatch (expected {:?})",
                    current_ops_owner
                );
                return Err(SolitaireError::InvalidOwner(*accs.ops_owner.info().key));
            }

            cfg_struct.is_active = new_is_active;

            Ok(())
        }
    }
}
