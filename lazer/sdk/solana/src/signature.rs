use {
    anchor_lang::{prelude::Clock, AccountDeserialize},
    bytemuck::{cast_slice, checked::try_cast_slice, Pod, Zeroable},
    byteorder::{ByteOrder, LE},
    solana_program::{
        account_info::AccountInfo,
        ed25519_program,
        program_error::ProgramError,
        pubkey::PUBKEY_BYTES,
        sysvar::{self, Sysvar},
    },
    thiserror::Error,
};

const ED25519_PROGRAM_INPUT_HEADER_LEN: usize = 2;

const SIGNATURE_LEN: u16 = 64;
const PUBKEY_LEN: u16 = 32;
const MAGIC_LEN: u16 = 4;
const MESSAGE_SIZE_LEN: u16 = 2;

/// Part of the inputs to the built-in `ed25519_program` on Solana that represents a single
/// signature verification request.
///
/// `ed25519_program` does not receive the signature data directly. Instead, it receives
/// these fields that indicate the location of the signature data within data of other
/// instructions within the same transaction.
#[derive(Debug, Clone, Copy, Zeroable, Pod)]
#[repr(C)]
pub struct Ed25519SignatureOffsets {
    /// Offset to the ed25519 signature within the instruction data.
    pub signature_offset: u16,
    /// Index of the instruction that contains the signature.
    pub signature_instruction_index: u16,
    /// Offset to the public key within the instruction data.
    pub public_key_offset: u16,
    /// Index of the instruction that contains the public key.
    pub public_key_instruction_index: u16,
    /// Offset to the signed payload within the instruction data.
    pub message_data_offset: u16,
    // Size of the signed payload.
    pub message_data_size: u16,
    /// Index of the instruction that contains the signed payload.
    pub message_instruction_index: u16,
}

/// Sets up `Ed25519SignatureOffsets` for verifying the Pyth Lazer message signature.
/// - `instruction_data` must be the *full* input data for your contract's instruction.
/// - `instruction_index` is the index of that instruction within the transaction.
/// - `starting_offset` is the offset of the Pyth Lazer message within the instruction data.
///
/// Panics if `starting_offset` is invalid or the `instruction_data` is not long enough to
/// contain the message.
pub fn signature_offsets(
    instruction_data: &[u8],
    instruction_index: u16,
    starting_offset: u16,
) -> Ed25519SignatureOffsets {
    let signature_offset = starting_offset + MAGIC_LEN;
    let public_key_offset = signature_offset + SIGNATURE_LEN;
    let message_data_size_offset = public_key_offset + PUBKEY_LEN;
    let message_data_offset = message_data_size_offset + MESSAGE_SIZE_LEN;
    let message_data_size = LE::read_u16(
        &instruction_data[message_data_size_offset.into()..message_data_offset.into()],
    );
    Ed25519SignatureOffsets {
        signature_offset,
        signature_instruction_index: instruction_index,
        public_key_offset,
        public_key_instruction_index: instruction_index,
        message_data_offset,
        message_data_size,
        message_instruction_index: instruction_index,
    }
}

/// Creates inputs to the built-in `ed25519_program` on Solana that verifies signatures.
pub fn ed25519_program_args(signatures: &[Ed25519SignatureOffsets]) -> Vec<u8> {
    let padding = 0u8;
    let mut signature_args = vec![
        signatures.len().try_into().expect("too many signatures"),
        padding,
    ];
    signature_args.extend_from_slice(cast_slice(signatures));
    signature_args
}

/// A message with a verified ed25519 signature.
#[derive(Debug, Clone, Copy)]
pub struct VerifiedMessage<'a> {
    /// Public key that signed the message.
    pub public_key: &'a [u8],
    /// Signed message payload.
    pub payload: &'a [u8],
}

#[derive(Debug, Error)]
pub enum SignatureVerificationError {
    #[error("ed25519 instruction must precede current instruction")]
    Ed25519InstructionMustPrecedeCurrentInstruction,
    #[error("load instruction at failed")]
    LoadInstructionAtFailed(#[source] ProgramError),
    #[error("load current index failed")]
    LoadCurrentIndexFailed(#[source] ProgramError),
    #[error("load current index failed")]
    ClockGetFailed(#[source] ProgramError),
    #[error("invalid ed25519 instruction program")]
    InvalidEd25519InstructionProgramId,
    #[error("invalid ed25519 instruction data length")]
    InvalidEd25519InstructionDataLength,
    #[error("invalid signature index")]
    InvalidSignatureIndex,
    #[error("invalid signature offset")]
    InvalidSignatureOffset,
    #[error("invalid public key offset")]
    InvalidPublicKeyOffset,
    #[error("invalid message offset")]
    InvalidMessageOffset,
    #[error("invalid message data size")]
    InvalidMessageDataSize,
    #[error("invalid instruction index")]
    InvalidInstructionIndex,
    #[error("message offset overflow")]
    MessageOffsetOverflow,
    #[error("format magic mismatch")]
    FormatMagicMismatch,
    #[error("invalid storage account id")]
    InvalidStorageAccountId,
    #[error("invalid storage data")]
    InvalidStorageData,
    #[error("not a trusted signer")]
    NotTrustedSigner,
}

impl From<SignatureVerificationError> for ProgramError {
    fn from(value: SignatureVerificationError) -> Self {
        match value {
            SignatureVerificationError::LoadInstructionAtFailed(e)
            | SignatureVerificationError::ClockGetFailed(e)
            | SignatureVerificationError::LoadCurrentIndexFailed(e) => e,
            SignatureVerificationError::InvalidStorageData => ProgramError::InvalidAccountData,
            SignatureVerificationError::NotTrustedSigner => ProgramError::MissingRequiredSignature,
            _ => ProgramError::InvalidInstructionData,
        }
    }
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
pub fn verify_message<'a>(
    pyth_storage_account: &AccountInfo,
    instruction_sysvar: &AccountInfo,
    message_data: &'a [u8],
    ed25519_instruction_index: u16,
    signature_index: u8,
    message_offset: u16,
) -> Result<VerifiedMessage<'a>, SignatureVerificationError> {
    if pyth_storage_account.key != &pyth_lazer_solana_contract::storage::ID {
        return Err(SignatureVerificationError::InvalidStorageAccountId);
    }
    let storage = {
        let storage_data = pyth_storage_account.data.borrow();
        let mut storage_data: &[u8] = *storage_data;
        pyth_lazer_solana_contract::Storage::try_deserialize(&mut storage_data)
            .map_err(|_| SignatureVerificationError::InvalidStorageData)?
    };

    const SOLANA_FORMAT_MAGIC_LE: u32 = 2182742457;

    let self_instruction_index =
        sysvar::instructions::load_current_index_checked(instruction_sysvar)
            .map_err(SignatureVerificationError::LoadCurrentIndexFailed)?;

    if ed25519_instruction_index >= self_instruction_index {
        return Err(SignatureVerificationError::Ed25519InstructionMustPrecedeCurrentInstruction);
    }

    let instruction = sysvar::instructions::load_instruction_at_checked(
        ed25519_instruction_index.into(),
        instruction_sysvar,
    )
    .map_err(SignatureVerificationError::LoadInstructionAtFailed)?;

    if instruction.program_id != ed25519_program::ID {
        return Err(SignatureVerificationError::InvalidEd25519InstructionProgramId);
    }
    if instruction.data.len() < ED25519_PROGRAM_INPUT_HEADER_LEN {
        return Err(SignatureVerificationError::InvalidEd25519InstructionDataLength);
    }

    let num_signatures = instruction.data[0];
    if signature_index >= num_signatures {
        return Err(SignatureVerificationError::InvalidSignatureIndex);
    }
    let args: &[Ed25519SignatureOffsets] =
        try_cast_slice(&instruction.data[ED25519_PROGRAM_INPUT_HEADER_LEN..])
            .map_err(|_| SignatureVerificationError::InvalidEd25519InstructionDataLength)?;

    let args_len = args
        .len()
        .try_into()
        .map_err(|_| SignatureVerificationError::InvalidEd25519InstructionDataLength)?;
    if signature_index >= args_len {
        return Err(SignatureVerificationError::InvalidSignatureIndex);
    }
    let offsets = &args[usize::from(signature_index)];

    let expected_signature_offset = message_offset
        .checked_add(MAGIC_LEN)
        .ok_or(SignatureVerificationError::MessageOffsetOverflow)?;
    if offsets.signature_offset != expected_signature_offset {
        return Err(SignatureVerificationError::InvalidSignatureOffset);
    }

    let magic = LE::read_u32(&message_data[..MAGIC_LEN.into()]);
    if magic != SOLANA_FORMAT_MAGIC_LE {
        return Err(SignatureVerificationError::FormatMagicMismatch);
    }

    let expected_public_key_offset = expected_signature_offset
        .checked_add(SIGNATURE_LEN)
        .ok_or(SignatureVerificationError::MessageOffsetOverflow)?;
    if offsets.public_key_offset != expected_public_key_offset {
        return Err(SignatureVerificationError::InvalidPublicKeyOffset);
    }

    let expected_message_size_offset = expected_public_key_offset
        .checked_add(PUBKEY_LEN)
        .ok_or(SignatureVerificationError::MessageOffsetOverflow)?;

    let expected_message_data_offset = expected_message_size_offset
        .checked_add(MESSAGE_SIZE_LEN)
        .ok_or(SignatureVerificationError::MessageOffsetOverflow)?;
    if offsets.message_data_offset != expected_message_data_offset {
        return Err(SignatureVerificationError::InvalidMessageOffset);
    }

    let expected_message_size = {
        let start = usize::from(
            expected_message_size_offset
                .checked_sub(message_offset)
                .unwrap(),
        );
        let end = usize::from(
            expected_message_data_offset
                .checked_sub(message_offset)
                .unwrap(),
        );
        LE::read_u16(&message_data[start..end])
    };
    if offsets.message_data_size != expected_message_size {
        return Err(SignatureVerificationError::InvalidMessageDataSize);
    }
    if offsets.signature_instruction_index != self_instruction_index
        || offsets.public_key_instruction_index != self_instruction_index
        || offsets.message_instruction_index != self_instruction_index
    {
        return Err(SignatureVerificationError::InvalidInstructionIndex);
    }

    let public_key = {
        let start = usize::from(
            expected_public_key_offset
                .checked_sub(message_offset)
                .unwrap(),
        );
        let end = start
            .checked_add(PUBKEY_BYTES)
            .ok_or(SignatureVerificationError::MessageOffsetOverflow)?;
        &message_data[start..end]
    };
    let now = Clock::get()
        .map_err(SignatureVerificationError::ClockGetFailed)?
        .unix_timestamp;
    if !storage
        .initialized_trusted_signers()
        .iter()
        .any(|s| s.pubkey.as_ref() == public_key && s.expires_at > now)
    {
        return Err(SignatureVerificationError::NotTrustedSigner);
    }

    let payload = {
        let start = usize::from(
            expected_message_data_offset
                .checked_sub(message_offset)
                .unwrap(),
        );
        let end = start
            .checked_add(expected_message_size.into())
            .ok_or(SignatureVerificationError::MessageOffsetOverflow)?;
        &message_data[start..end]
    };

    Ok(VerifiedMessage {
        public_key,
        payload,
    })
}
