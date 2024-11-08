use {
    self::accounts::{PostUpdate, PostUpdateAtomic},
    crate::{PostUpdateAtomicParams, PostUpdateParams},
    anchor_lang::prelude::*,
};

pub mod accounts;

// This implementation comes from the expanded macros of programs/pyth-solana-receiver/src/lib.rs
pub fn post_update<'info>(
    ctx: anchor_lang::context::CpiContext<'_, '_, '_, 'info, PostUpdate<'info>>,
    params: PostUpdateParams,
) -> anchor_lang::Result<()> {
    let ix = {
        let mut ix_data = AnchorSerialize::try_to_vec(&params)
            .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
        let mut data = [133, 95, 207, 175, 11, 79, 118, 44].to_vec();
        data.append(&mut ix_data);
        let accounts = ctx.to_account_metas(None);
        anchor_lang::solana_program::instruction::Instruction {
            program_id: crate::ID,
            accounts,
            data,
        }
    };
    let acc_infos = ctx.to_account_infos();
    anchor_lang::solana_program::program::invoke_signed(&ix, &acc_infos, ctx.signer_seeds)
        .map_or_else(|e| Err(Into::into(e)), |_| Ok(()))
}

// This implementation comes from the expanded macros of programs/pyth-solana-receiver/src/lib.rs
pub fn post_update_atomic<'info>(
    ctx: anchor_lang::context::CpiContext<'_, '_, '_, 'info, PostUpdateAtomic<'info>>,
    params: PostUpdateAtomicParams,
) -> anchor_lang::Result<()> {
    let ix = {
        let mut ix_data = AnchorSerialize::try_to_vec(&params)
            .map_err(|_| anchor_lang::error::ErrorCode::InstructionDidNotSerialize)?;
        let mut data = [49, 172, 84, 192, 175, 180, 52, 234].to_vec();
        data.append(&mut ix_data);
        let accounts = ctx.to_account_metas(None);
        anchor_lang::solana_program::instruction::Instruction {
            program_id: crate::ID,
            accounts,
            data,
        }
    };
    let acc_infos = ctx.to_account_infos();
    anchor_lang::solana_program::program::invoke_signed(&ix, &acc_infos, ctx.signer_seeds)
        .map_or_else(|e| Err(Into::into(e)), |_| Ok(()))
}
