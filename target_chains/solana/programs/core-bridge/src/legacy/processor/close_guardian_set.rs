use crate::{
    error::CoreBridgeError,
    legacy::instruction::EmptyArgs,
    sdk::legacy::{AccountVariant, LegacyAnchorized},
    state::{Config, GuardianSet, LEGACY_GUARDIANS},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseGuardianSet<'info> {
    #[account(mut)]
    recipient: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
    config: Account<'info, LegacyAnchorized<Config>>,

    #[account(
        mut,
        close = recipient,
        seeds = [
            GuardianSet::SEED_PREFIX,
            config.guardian_set_index.to_be_bytes().as_ref()
        ],
        bump,
        // At least one guardian is from the legacy guardian sets.
        constraint = guardian_set
            .inner()
            .keys
            .iter()
            .any(|key| LEGACY_GUARDIANS.contains(key))
            @ CoreBridgeError::NoLegacyGuardians
    )]
    guardian_set: Account<'info, AccountVariant<GuardianSet>>,
}

impl<'info> crate::legacy::utils::ProcessLegacyInstruction<'info, EmptyArgs>
    for CloseGuardianSet<'info>
{
    const LOG_IX_NAME: &'static str = "LegacyCloseGuardianSet";

    const ANCHOR_IX_FN: fn(Context<Self>, EmptyArgs) -> Result<()> = close_guardian_set;
}

/// Processor to remove a guardian set account containing a legacy guardian.
/// This instruction is permissionless - anyone can call it.
fn close_guardian_set(ctx: Context<CloseGuardianSet>, _args: EmptyArgs) -> Result<()> {
    ctx.accounts.config.guardian_set_index =
        ctx.accounts.config.guardian_set_index.saturating_sub(1);
    Ok(())
}
