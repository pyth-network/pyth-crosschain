use {
    anchor_lang::{prelude::*, solana_program::pubkey::PUBKEY_BYTES},
    std::mem::size_of,
};

declare_id!("pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt");

pub mod storage {
    use anchor_lang::declare_id;

    declare_id!("3rdJbqfnagQ4yx9HXJViD4zc4xpiSqmFsKpPuSCQVyQL");

    #[test]
    fn test_storage_id() {
        use {crate::STORAGE_SEED, anchor_lang::prelude::Pubkey};

        assert_eq!(
            Pubkey::find_program_address(&[STORAGE_SEED], &super::ID).0,
            ID
        );
    }
}

pub const MAX_NUM_TRUSTED_SIGNERS: usize = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, AnchorSerialize, AnchorDeserialize)]
pub struct TrustedSignerInfo {
    pub pubkey: Pubkey,
    pub expires_at: i64,
}

impl TrustedSignerInfo {
    const SERIALIZED_LEN: usize = PUBKEY_BYTES + size_of::<i64>();
}

#[account]
pub struct Storage {
    pub top_authority: Pubkey,
    pub num_trusted_signers: u8,
    pub trusted_signers: [TrustedSignerInfo; MAX_NUM_TRUSTED_SIGNERS],
}

impl Storage {
    const SERIALIZED_LEN: usize = PUBKEY_BYTES
        + size_of::<u8>()
        + TrustedSignerInfo::SERIALIZED_LEN * MAX_NUM_TRUSTED_SIGNERS;

    pub fn initialized_trusted_signers(&self) -> &[TrustedSignerInfo] {
        &self.trusted_signers[0..usize::from(self.num_trusted_signers)]
    }
}

pub const STORAGE_SEED: &[u8] = b"storage";

#[program]
pub mod pyth_lazer_solana_contract {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, top_authority: Pubkey) -> Result<()> {
        ctx.accounts.storage.top_authority = top_authority;
        Ok(())
    }

    pub fn update(ctx: Context<Update>, trusted_signer: Pubkey, expires_at: i64) -> Result<()> {
        let num_trusted_signers: usize = ctx.accounts.storage.num_trusted_signers.into();
        if num_trusted_signers > ctx.accounts.storage.trusted_signers.len() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        let mut trusted_signers =
            ctx.accounts.storage.trusted_signers[..num_trusted_signers].to_vec();
        if expires_at == 0 {
            // Delete
            let pos = trusted_signers
                .iter()
                .position(|item| item.pubkey == trusted_signer)
                .ok_or(ProgramError::InvalidInstructionData)?;
            trusted_signers.remove(pos);
        } else if let Some(item) = trusted_signers
            .iter_mut()
            .find(|item| item.pubkey == trusted_signer)
        {
            // Modify
            item.expires_at = expires_at;
        } else {
            // Add
            trusted_signers.push(TrustedSignerInfo {
                pubkey: trusted_signer,
                expires_at,
            });
        }

        if trusted_signers.len() > ctx.accounts.storage.trusted_signers.len() {
            return Err(ProgramError::AccountDataTooSmall.into());
        }

        ctx.accounts.storage.trusted_signers = Default::default();
        ctx.accounts.storage.trusted_signers[..trusted_signers.len()]
            .copy_from_slice(&trusted_signers);
        ctx.accounts.storage.num_trusted_signers = trusted_signers
            .len()
            .try_into()
            .expect("num signers overflow");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Storage::SERIALIZED_LEN,
        seeds = [STORAGE_SEED],
        bump,
    )]
    pub storage: Account<'info, Storage>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    pub top_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [STORAGE_SEED],
        bump,
        has_one = top_authority,
    )]
    pub storage: Account<'info, Storage>,
}
