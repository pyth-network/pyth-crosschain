use anchor_lang::prelude::*;
use anchor_syn::codegen::program::common::sighash;

pub fn check_permission_cpi<'info>(
    express_relay: Pubkey,
    sysvar_instructions: anchor_lang::solana_program::account_info::AccountInfo<'info>,
    permission: anchor_lang::solana_program::account_info::AccountInfo<'info>,
    router: anchor_lang::solana_program::account_info::AccountInfo<'info>,
) -> Result<()> {
    let discriminator = sighash("global", "check_permission");
    let data = &discriminator.to_vec();

    anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::instruction::Instruction {
            program_id: express_relay,
            accounts: vec![
                AccountMeta::new_readonly(*sysvar_instructions.key, false),
                AccountMeta::new_readonly(*permission.key, false),
                AccountMeta::new_readonly(*router.key, false)
            ],
            data: data.clone(),
        },
        &[sysvar_instructions, permission, router],
    ).map_or_else(|e| Err(Into::into(e)), |_| Ok(()))
}
