use {
    crate::config::{
        P2WConfigAccount,
        Pyth2WormholeConfig,
    },
    solana_program::{
        program::invoke,
        rent::Rent,
        system_instruction,
        sysvar::Sysvar,
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

    // TODO(2022-09-05): Remove this rent collection after
    // sysvar-based rent calculation becomes mainline in Solitaire.
    let config_balance = accs.new_config.info().lamports();
    let config_rent_exempt = Rent::get()?.minimum_balance(accs.new_config.info().data_len());

    if config_balance < config_rent_exempt {
        let required_deposit = config_rent_exempt - config_balance;

        let transfer_ix = system_instruction::transfer(
            accs.payer.key,
            accs.new_config.info().key,
            required_deposit,
        );
        invoke(&transfer_ix, ctx.accounts)?
    }

    Ok(())
}
