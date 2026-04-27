use crate::{
    legacy::{instruction::EmptyArgs, utils::LegacyAnchorized},
    state::Config,
};
use anchor_lang::prelude::*;

/// Fixed guardian set TTL value: 86400 seconds (24 hours).
const GUARDIAN_SET_TTL_SECONDS: u32 = 86400;

#[derive(Accounts)]
pub struct UpdateGuardianSetTtl<'info> {
    /// Config account storing the bridge configuration including the guardian set TTL.
    #[account(
        mut,
        seeds = [Config::SEED_PREFIX],
        bump,
    )]
    config: Account<'info, LegacyAnchorized<Config>>,
}

impl<'info> crate::legacy::utils::ProcessLegacyInstruction<'info, EmptyArgs>
    for UpdateGuardianSetTtl<'info>
{
    const LOG_IX_NAME: &'static str = "LegacyUpdateGuardianSetTtl";

    const ANCHOR_IX_FN: fn(Context<Self>, EmptyArgs) -> Result<()> = update_guardian_set_ttl;
}

/// Processor to update the guardian set TTL to a fixed value of 86400 seconds (24 hours).
/// This instruction is permissionless - anyone can call it.
fn update_guardian_set_ttl(ctx: Context<UpdateGuardianSetTtl>, _args: EmptyArgs) -> Result<()> {
    ctx.accounts.config.guardian_set_ttl = GUARDIAN_SET_TTL_SECONDS.into();

    Ok(())
}
