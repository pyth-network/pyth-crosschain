use {
    crate::config::{
        P2WConfigAccount,
        Pyth2WormholeConfig,
    },
    borsh::BorshSerialize,
    solana_program::{
        program::invoke,
        rent::Rent,
        system_instruction,
        sysvar::Sysvar,
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
pub struct SetConfig<'b> {
    /// Current config used by the program
    pub config:         Mut<P2WConfigAccount<'b, { AccountState::Initialized }>>,
    /// Current owner authority of the program
    pub current_owner:  Mut<Signer<Info<'b>>>,
    /// Payer account for updating the account data
    pub payer:          Mut<Signer<Info<'b>>>,
    /// Used for rent adjustment transfer
    pub system_program: Info<'b>,
}

/// Alters the current settings of pyth2wormhole
pub fn set_config(
    ctx: &ExecutionContext,
    accs: &mut SetConfig,
    data: Pyth2WormholeConfig,
) -> SoliResult<()> {
    let cfg_struct: &Pyth2WormholeConfig = &accs.config; // unpack Data via nested Deref impls
    if &cfg_struct.owner != accs.current_owner.info().key {
        trace!(
            "Current owner account mismatch (expected {:?})",
            cfg_struct.owner
        );
        return Err(SolitaireError::InvalidSigner(
            *accs.current_owner.info().key,
        ));
    }

    let old_size = accs.config.info().data_len();
    let new_size = data.try_to_vec()?.len();

    // Realloc if mismatched
    if old_size != new_size {
        accs.config.info().realloc(new_size, false)?;
    }

    accs.config.1 = data;

    // Adjust lamports
    let acc_lamports = accs.config.info().lamports();

    let new_lamports = Rent::get()?.minimum_balance(new_size);

    let diff_lamports: u64 = (acc_lamports as i64 - new_lamports as i64).unsigned_abs();

    if acc_lamports < new_lamports {
        // Less than enough lamports, debit the payer
        let transfer_ix = system_instruction::transfer(
            accs.payer.info().key,
            accs.config.info().key,
            diff_lamports,
        );
        invoke(&transfer_ix, ctx.accounts)?;
    }

    Ok(())
}
