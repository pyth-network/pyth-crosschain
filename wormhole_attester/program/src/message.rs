//! Index-based PDA for storing unreliable wormhole message
//!
//! The main goal of this PDA is to take advantage of wormhole message
//! reuse securely. This is achieved by tying the account derivation
//! data to the payer account of the attest() instruction. Inside
//! attest(), payer must be a signer, and the message account must be
//! derived with their address as message_owner in
//! `P2WMessageDrvData`.

use {
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
    bridge::PostedMessageUnreliable,
    solana_program::pubkey::Pubkey,
    solitaire::{
        processors::seeded::Seeded,
        AccountState,
        Mut,
    },
};

pub type P2WMessage<'a> = Mut<PostedMessageUnreliable<'a, { AccountState::MaybeInitialized }>>;

#[derive(BorshDeserialize, BorshSerialize)]
pub struct P2WMessageDrvData {
    /// The key owning this message account
    pub message_owner: Pubkey,
    /// Size of the batch. It is important that all messages have the same size
    ///
    /// NOTE: 2022-09-05
    /// Currently wormhole does not resize accounts if they have different
    /// payload sizes; this (along with versioning the seed literal below) is
    /// a workaround to have different PDAs for different batch sizes.
    pub batch_size:    u16,
    /// Index for keeping many accounts per owner
    pub id:            u64,
}

impl<'a> Seeded<&P2WMessageDrvData> for P2WMessage<'a> {
    fn seeds(data: &P2WMessageDrvData) -> Vec<Vec<u8>> {
        vec![
            // See the note at 2022-09-05 above.
            // Change the version in the literal whenever you change the
            // price attestation data.
            "p2w-message-v2".as_bytes().to_vec(),
            data.message_owner.to_bytes().to_vec(),
            data.batch_size.to_be_bytes().to_vec(),
            data.id.to_be_bytes().to_vec(),
        ]
    }
}
