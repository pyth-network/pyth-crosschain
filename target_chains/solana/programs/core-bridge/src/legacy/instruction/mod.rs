//! Module containing the program’s set of instructions, where each method handler is associated
//! with a struct defining the input arguments to the method. These should be used directly, when
//! one wants to serialize instruction data, for example, when speciying instructions on a client.

use anchor_lang::prelude::{AnchorDeserialize, AnchorSerialize};

/// Legacy instruction selector.
///
/// NOTE: No more instructions should be added to this enum. Instead, add them as Anchor instruction
/// handlers, which will inevitably live in
/// [wormhole_core_bridge_solana](crate::wormhole_core_bridge_solana).
#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub enum LegacyInstruction {
    /// Initialize the program.
    Initialize,
    /// Removed instruction (formerly `PostMessage`). This variant is kept as a placeholder so the
    /// remaining variants keep their original serialized discriminants.
    _RemovedPostMessage,
    /// Write an account reflecting a verified VAA (Version 1).
    PostVaa,
    /// Removed instruction (formerly the `SetMessageFee` governance instruction). This variant is
    /// kept as a placeholder so the remaining variants keep their original serialized
    /// discriminants.
    _RemovedSetMessageFee,
    /// Removed instruction (formerly the `TransferFees` governance instruction). This variant is
    /// kept as a placeholder so the remaining variants keep their original serialized
    /// discriminants.
    _RemovedTransferFees,
    /// Removed instruction (formerly the `UpgradeContract` governance instruction). This variant
    /// is kept as a placeholder so the remaining variants keep their original serialized
    /// discriminants.
    _RemovedUpgradeContract,
    /// **Governance.** Update the guardian set.
    GuardianSetUpdate,
    /// Verify guardian signatures of a VAA (Version 1).
    VerifySignatures,
}

/// Arguments used to initialize the Core Bridge program.
#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeArgs {
    pub guardian_set_ttl_seconds: u32,
    pub fee_lamports: u64,
    pub initial_guardians: Vec<[u8; 20]>,
}

/// Arguments to post new VAA data after signature verification.
///
/// NOTE: It is preferred to use the new process of verifying a VAA using the new Core Bridge Anchor
/// instructions. See [init_encoded_vaa](crate::wormhole_core_bridge_solana::init_encoded_vaa) and
/// [write_encoded_vaa](crate::wormhole_core_bridge_solana::write_encoded_vaa) for more info.
#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PostVaaArgs {
    /// Unused data.
    pub _gap_0: [u8; 5],
    /// Time the message was submitted.
    pub timestamp: u32,
    /// Unique ID for this message.
    pub nonce: u32,
    /// The Wormhole chain ID denoting the origin of this message.
    pub emitter_chain: u16,
    /// Emitter of the message.
    pub emitter_address: [u8; 32],
    /// Sequence number of this message.
    pub sequence: u64,
    /// Level of consistency requested by the emitter.
    pub consistency_level: u8,
    /// Message payload.
    pub payload: Vec<u8>,
}

/// Arguments to verify specific guardian indices.
///
/// NOTE: It is preferred to use the new process of verifying a VAA using the new Core Bridge Anchor
/// instructions. See [init_encoded_vaa](crate::wormhole_core_bridge_solana::init_encoded_vaa) and
/// [write_encoded_vaa](crate::wormhole_core_bridge_solana::write_encoded_vaa) for more info.
#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VerifySignaturesArgs {
    /// Indices of verified guardian signatures, where -1 indicates a missing value. There is a
    /// missing value if the guardian at this index is not expected to have its signature verfied by
    /// the Sig Verify native program in the instruction invoked prior).
    ///
    /// NOTE: In the legacy implementation, this argument being a fixed-sized array of 19 only
    /// allows the first 19 guardians of any size guardian set to be verified. Because of this, it
    /// is absolutely important to use the new process of verifying a VAA.
    pub signer_indices: [i8; 19],
}

/// Unit struct used to represent an empty instruction argument.
#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct EmptyArgs {}
