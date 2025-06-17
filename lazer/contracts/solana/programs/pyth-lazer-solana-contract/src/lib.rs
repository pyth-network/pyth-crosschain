#![allow(unexpected_cfgs)] // anchor macro triggers it

mod signature;

use {
    crate::signature::VerifiedMessage,
    anchor_lang::{
        prelude::*,
        solana_program::{keccak, pubkey::PUBKEY_BYTES, secp256k1_recover::secp256k1_recover},
        system_program,
    },
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

pub const ANCHOR_DISCRIMINATOR_BYTES: usize = 8;
pub const MAX_NUM_TRUSTED_SIGNERS: usize = 2;
pub const SPACE_FOR_TRUSTED_SIGNERS: usize = 5;
pub const SPACE_FOR_TRUSTED_ECDSA_SIGNERS: usize = 2;
pub const EXTRA_SPACE: usize = 43;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, AnchorSerialize, AnchorDeserialize)]
pub struct TrustedSignerInfo<T> {
    pub pubkey: T,
    pub expires_at: i64,
}

pub const EVM_ADDRESS_LEN: usize = 20;
pub type EvmAddress = [u8; EVM_ADDRESS_LEN];

#[account]
#[derive(Debug, PartialEq)]
pub struct Storage {
    pub top_authority: Pubkey,
    pub treasury: Pubkey,
    pub single_update_fee_in_lamports: u64,
    pub num_trusted_signers: u8,
    pub trusted_signers: [TrustedSignerInfo<Pubkey>; SPACE_FOR_TRUSTED_SIGNERS],
    pub num_trusted_ecdsa_signers: u8,
    pub trusted_ecdsa_signers: [TrustedSignerInfo<EvmAddress>; SPACE_FOR_TRUSTED_ECDSA_SIGNERS],
    pub _extra_space: [u8; EXTRA_SPACE],
}

#[test]
fn storage_size() {
    // Keep the size the same when possible. If the size increases, we'll need to perform
    // a migration that increases the account size on-chain.
    assert_eq!(Storage::SERIALIZED_LEN, 373);
}

impl Storage {
    const SERIALIZED_LEN: usize = PUBKEY_BYTES
        + PUBKEY_BYTES
        + size_of::<u64>()
        + size_of::<u8>()
        + (PUBKEY_BYTES + size_of::<i64>()) * SPACE_FOR_TRUSTED_SIGNERS
        + size_of::<u8>()
        + (EVM_ADDRESS_LEN + size_of::<i64>()) * SPACE_FOR_TRUSTED_ECDSA_SIGNERS
        + EXTRA_SPACE;

    pub fn initialized_trusted_signers(&self) -> &[TrustedSignerInfo<Pubkey>] {
        &self.trusted_signers[0..usize::from(self.num_trusted_signers)]
    }

    pub fn initialized_trusted_ecdsa_signers(&self) -> &[TrustedSignerInfo<EvmAddress>] {
        &self.trusted_ecdsa_signers[0..usize::from(self.num_trusted_ecdsa_signers)]
    }

    pub fn is_trusted(&self, signer: &Pubkey) -> std::result::Result<bool, ProgramError> {
        let now = Clock::get()?.unix_timestamp;

        Ok(self
            .initialized_trusted_signers()
            .iter()
            .any(|s| &s.pubkey == signer && s.expires_at > now))
    }

    pub fn is_ecdsa_trusted(&self, signer: &EvmAddress) -> std::result::Result<bool, ProgramError> {
        let now = Clock::get()?.unix_timestamp;

        Ok(self
            .initialized_trusted_ecdsa_signers()
            .iter()
            .any(|s| &s.pubkey == signer && s.expires_at > now))
    }
}

pub const STORAGE_SEED: &[u8] = b"storage";

#[program]
pub mod pyth_lazer_solana_contract {
    use pyth_lazer_protocol::message::LeEcdsaMessage;

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        top_authority: Pubkey,
        treasury: Pubkey,
    ) -> Result<()> {
        ctx.accounts.storage.top_authority = top_authority;
        ctx.accounts.storage.treasury = treasury;
        ctx.accounts.storage.single_update_fee_in_lamports = 1;
        Ok(())
    }

    pub fn update(ctx: Context<Update>, trusted_signer: Pubkey, expires_at: i64) -> Result<()> {
        let storage = &mut *ctx.accounts.storage;
        update_trusted_signer(
            &mut storage.num_trusted_signers,
            &mut storage.trusted_signers,
            trusted_signer,
            expires_at,
        )
    }

    pub fn update_ecdsa_signer(
        ctx: Context<Update>,
        trusted_signer: EvmAddress,
        expires_at: i64,
    ) -> Result<()> {
        let storage = &mut *ctx.accounts.storage;
        update_trusted_signer(
            &mut storage.num_trusted_ecdsa_signers,
            &mut storage.trusted_ecdsa_signers,
            trusted_signer,
            expires_at,
        )
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
        )
        .map_err(|err| {
            msg!("signature verification error: {:?}", err);
            err.into()
        })
    }

    pub fn verify_ecdsa_message(
        ctx: Context<VerifyEcdsaMessage>,
        message_data: Vec<u8>,
    ) -> Result<()> {
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

        let message = LeEcdsaMessage::deserialize_slice(&message_data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        let pubkey = secp256k1_recover(
            &keccak::hash(&message.payload).0,
            message.recovery_id,
            &message.signature,
        )
        .map_err(|err| {
            msg!("secp256k1_recover failed: {:?}", err);
            ProgramError::InvalidInstructionData
        })?;
        let addr: EvmAddress = keccak::hash(&pubkey.0).0[12..]
            .try_into()
            .expect("invalid addr len");
        if addr == EvmAddress::default() {
            msg!("secp256k1_recover failed: zero output");
            return Err(ProgramError::InvalidInstructionData.into());
        }
        if !ctx.accounts.storage.is_ecdsa_trusted(&addr)? {
            msg!("untrusted signer: {:?}", addr);
            return Err(ProgramError::MissingRequiredSignature.into());
        }
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
        space = ANCHOR_DISCRIMINATOR_BYTES + Storage::SERIALIZED_LEN,
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

#[derive(Accounts)]
pub struct VerifyMessage<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [STORAGE_SEED],
        bump,
        has_one = treasury
    )]
    pub storage: Account<'info, Storage>,
    /// CHECK: this account doesn't need additional constraints.
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: account ID is checked in Solana SDK during calls
    /// (e.g. in `sysvar::instructions::load_instruction_at_checked`).
    /// This account is not usable with anchor's `Program` account type because it's not executable.
    pub instructions_sysvar: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct VerifyEcdsaMessage<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [STORAGE_SEED],
        bump,
        has_one = treasury
    )]
    pub storage: Account<'info, Storage>,
    /// CHECK: this account doesn't need additional constraints.
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

fn update_trusted_signer<T: Copy + PartialEq + Default>(
    stored_num_trusted_signers: &mut u8,
    stored_trusted_signers: &mut [TrustedSignerInfo<T>],
    trusted_signer: T,
    expires_at: i64,
) -> Result<()> {
    let num_trusted_signers: usize = (*stored_num_trusted_signers).into();
    if num_trusted_signers > stored_trusted_signers.len() {
        return Err(ProgramError::InvalidAccountData.into());
    }
    if num_trusted_signers > MAX_NUM_TRUSTED_SIGNERS {
        return Err(ProgramError::InvalidAccountData.into());
    }
    let mut trusted_signers = stored_trusted_signers[..num_trusted_signers].to_vec();
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

    if trusted_signers.len() > trusted_signers.len() {
        return Err(ProgramError::AccountDataTooSmall.into());
    }
    if trusted_signers.len() > MAX_NUM_TRUSTED_SIGNERS {
        return Err(ProgramError::InvalidInstructionData.into());
    }

    stored_trusted_signers[..trusted_signers.len()].copy_from_slice(&trusted_signers);
    for item in &mut stored_trusted_signers[trusted_signers.len()..] {
        *item = Default::default();
    }
    *stored_num_trusted_signers = trusted_signers
        .len()
        .try_into()
        .expect("num signers overflow");
    Ok(())
}

#[test]
fn test_storage_compat_after_adding_ecdsa() {
    // This is data of a storage account created by the previous version of the contract.
    let data = [
        209, 117, 255, 185, 196, 175, 68, 9, 221, 56, 75, 202, 174, 248, 122, 155, 212, 29, 112,
        50, 82, 65, 161, 137, 16, 164, 61, 134, 119, 132, 149, 1, 178, 177, 3, 187, 25, 187, 143,
        244, 233, 140, 161, 230, 115, 255, 214, 103, 208, 40, 16, 101, 45, 35, 153, 15, 145, 134,
        250, 244, 248, 255, 51, 165, 169, 186, 183, 210, 155, 137, 30, 84, 1, 0, 0, 0, 0, 0, 0, 0,
        1, 116, 49, 58, 101, 37, 237, 249, 153, 54, 170, 20, 119, 233, 76, 114, 188, 92, 198, 23,
        178, 23, 69, 245, 240, 50, 150, 243, 21, 68, 97, 242, 20, 255, 255, 255, 255, 255, 255,
        255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    let storage = Storage::deserialize(&mut &data[..]).unwrap();
    assert_eq!(
        storage,
        Storage {
            top_authority: pubkey!("F6eZvgfuPtncCUDzYgzaFPRodHwZXQHe1pC4kkyvkYwa"),
            treasury: pubkey!("D2Y884NqR9TVagZftdzzuEgtTEwd3AsS2nLMHEnVkXCQ"),
            single_update_fee_in_lamports: 6061433450835458729,
            num_trusted_signers: 1,
            trusted_signers: [
                TrustedSignerInfo {
                    pubkey: pubkey!("1111111avyLnoUfmuX6KZaaTrSfth7n9tX4u4rVV"),
                    expires_at: 1509375770176493106
                },
                TrustedSignerInfo {
                    pubkey: pubkey!("JEKNVnkbo2qryGmQn1b2RCJcGKVCn6WvNZmFdEiZGVSo"),
                    expires_at: 0
                },
                TrustedSignerInfo {
                    pubkey: Pubkey::default(),
                    expires_at: 0
                },
                TrustedSignerInfo {
                    pubkey: Pubkey::default(),
                    expires_at: 0
                },
                TrustedSignerInfo {
                    pubkey: Pubkey::default(),
                    expires_at: 0
                }
            ],
            num_trusted_ecdsa_signers: 0,
            trusted_ecdsa_signers: [
                TrustedSignerInfo {
                    pubkey: Default::default(),
                    expires_at: 0
                },
                TrustedSignerInfo {
                    pubkey: Default::default(),
                    expires_at: 0
                },
            ],
            _extra_space: [0; 43],
        }
    );
}
