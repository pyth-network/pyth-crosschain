use {
    crate::config::{
        P2WConfigAccount,
        Pyth2WormholeConfig,
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
    },
};

#[derive(FromAccounts)]
pub struct Initialize<'b> {
    pub new_config:     Mut<P2WConfigAccount<'b, { AccountState::Uninitialized }>>,
    pub payer:          Mut<Signer<Info<'b>>>,
    pub system_program: Info<'b>,
}

/// Must be called right after deployment
pub fn initialize(
    ctx: &ExecutionContext,
    accs: &mut Initialize,
    data: Pyth2WormholeConfig,
) -> SoliResult<()> {
    accs.new_config
        .create(ctx, accs.payer.info().key, CreationLamports::Exempt)?;
    accs.new_config.1 = data;

    Ok(())
}
