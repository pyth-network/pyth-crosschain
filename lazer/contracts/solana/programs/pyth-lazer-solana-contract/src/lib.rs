mod signature;

use {
    crate::signature::VerifiedMessage,
    anchor_lang::{prelude::*, solana_program::pubkey::PUBKEY_BYTES, system_program},
    std::io::Cursor,
    std::mem::size_of,
};

pub use {
    crate::signature::{ed25519_program_args, Ed25519SignatureOffsets},
    pyth_lazer_protocol as protocol,
};

declare_id!("pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt");

pub const STORAGE_ID: Pubkey = pubkey!("3rdJbqfnagQ4yx9HXJViD4zc4xpiSqmFsKpPuSCQVyQL");

#[test]
fn test_ids() {
    assert_eq!(
        Pubkey::find_program_address(&[STORAGE_SEED], &ID).0,
        STORAGE_ID
    );
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
pub struct StorageV1 {
    pub top_authority: Pubkey,
    pub num_trusted_signers: u8,
    pub trusted_signers: [TrustedSignerInfo; MAX_NUM_TRUSTED_SIGNERS],
}

impl StorageV1 {
    const SERIALIZED_LEN: usize = PUBKEY_BYTES
        + size_of::<u8>()
        + TrustedSignerInfo::SERIALIZED_LEN * MAX_NUM_TRUSTED_SIGNERS;

    pub fn initialized_trusted_signers(&self) -> &[TrustedSignerInfo] {
        &self.trusted_signers[0..usize::from(self.num_trusted_signers)]
    }
}
#[account]
pub struct StorageV2 {
    pub top_authority: Pubkey,
    pub treasury: Pubkey,
    pub single_update_fee_in_lamports: u64,
    pub num_trusted_signers: u8,
    pub trusted_signers: [TrustedSignerInfo; MAX_NUM_TRUSTED_SIGNERS],
}

impl StorageV2 {
    const SERIALIZED_LEN: usize = PUBKEY_BYTES
        + PUBKEY_BYTES
        + size_of::<u64>()
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

    pub fn initialize_v1(ctx: Context<InitializeV1>, top_authority: Pubkey) -> Result<()> {
        ctx.accounts.storage.top_authority = top_authority;
        Ok(())
    }

    pub fn initialize_v2(
        ctx: Context<InitializeV2>,
        top_authority: Pubkey,
        treasury: Pubkey,
    ) -> Result<()> {
        ctx.accounts.storage.top_authority = top_authority;
        ctx.accounts.storage.treasury = treasury;
        ctx.accounts.storage.single_update_fee_in_lamports = 1;
        Ok(())
    }

    pub fn migrate_to_storage_v2(ctx: Context<MigrateToStorageV2>, treasury: Pubkey) -> Result<()> {
        let old_storage = StorageV1::try_deserialize(&mut &**ctx.accounts.storage.data.borrow())?;
        if old_storage.top_authority != ctx.accounts.top_authority.key() {
            return Err(ProgramError::MissingRequiredSignature.into());
        }

        let space = 8 + StorageV2::SERIALIZED_LEN;
        ctx.accounts.storage.realloc(space, false)?;
        let min_lamports = Rent::get()?.minimum_balance(space);
        if ctx.accounts.storage.lamports() < min_lamports {
            return Err(ProgramError::AccountNotRentExempt.into());
        }

        let new_storage = StorageV2 {
            top_authority: old_storage.top_authority,
            treasury,
            single_update_fee_in_lamports: 1,
            num_trusted_signers: old_storage.num_trusted_signers,
            trusted_signers: old_storage.trusted_signers,
        };
        new_storage.try_serialize(&mut Cursor::new(
            &mut **ctx.accounts.storage.data.borrow_mut(),
        ))?;
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

    /// Verifies a ed25519 signature on Solana by checking that the transaction contains
    /// a correct call to the built-in `ed25519_program`.
    ///
    /// - `message_data` is the signed message that is being verified.
    /// - `ed25519_instruction_index` is the index of the `ed25519_program` instruction
    ///   within the transaction. This instruction must precede the current instruction.
    /// - `signature_index` is the index of the signature within the inputs to the `ed25519_program`.
    /// - `message_offset` is the offset of the signed message within the
    ///   input data for the current instruction.
    pub fn verify_message(
        ctx: Context<VerifyMessage>,
        message_data: Vec<u8>,
        ed25519_instruction_index: u16,
        signature_index: u8,
        message_offset: u16,
    ) -> Result<VerifiedMessage> {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            ctx.accounts.storage.single_update_fee_in_lamports,
        )?;

        signature::verify_message(
            &ctx.accounts.storage,
            &ctx.accounts.instructions_sysvar,
            &message_data,
            ed25519_instruction_index,
            signature_index,
            message_offset,
        )
        .map_err(|err| {
            msg!("signature verification error: {:?}", err);
            err.into()
        })
    }
}

#[derive(Accounts)]
pub struct InitializeV1<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + StorageV1::SERIALIZED_LEN,
        seeds = [STORAGE_SEED],
        bump,
    )]
    pub storage: Account<'info, StorageV1>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MigrateToStorageV2<'info> {
    pub top_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [STORAGE_SEED],
        bump,
    )]
    /// CHECK: top_authority in storage must match top_authority account.
    pub storage: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeV2<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + StorageV2::SERIALIZED_LEN,
        seeds = [STORAGE_SEED],
        bump,
    )]
    pub storage: Account<'info, StorageV2>,
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
    pub storage: Account<'info, StorageV2>,
}

#[derive(Accounts)]
pub struct VerifyMessage<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [STORAGE_SEED],
        bump,
        has_one = treasury
    )]
    pub storage: Account<'info, StorageV2>,
    /// CHECK: this account doesn't need additional constraints.
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: account ID is checked in Solana SDK during calls
    /// (e.g. in `sysvar::instructions::load_instruction_at_checked`).
    /// This account is not usable with anchor's `Program` account type because it's not executable.
    pub instructions_sysvar: AccountInfo<'info>,
}
