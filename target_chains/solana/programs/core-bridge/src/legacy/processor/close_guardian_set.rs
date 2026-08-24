use crate::{
    error::CoreBridgeError,
    legacy::instruction::EmptyArgs,
    sdk::legacy::AccountVariant,
    state::{GuardianSet, LEGACY_GUARDIANS},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseGuardianSet<'info> {
    #[account(mut)]
    recipient: UncheckedAccount<'info>,

    #[account(
        mut,
        close = recipient,
        seeds = [
            GuardianSet::SEED_PREFIX,
            guardian_set.inner().index.to_be_bytes().as_ref()
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
fn close_guardian_set(_ctx: Context<CloseGuardianSet>, _args: EmptyArgs) -> Result<()> {
    Ok(())
}
