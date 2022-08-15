//! Index-based PDA for storing unreliable wormhole message
use borsh::{
    BorshDeserialize,
    BorshSerialize,
};
use bridge::PostedMessage;
use solana_program::pubkey::Pubkey;
use solitaire::{
    AccountState,
    Data,
    processors::seeded::Seeded,
    Info,
    Signer,
    Mut,
};

pub type P2WMessage<'a> = Signer<Mut<PostedMessage<'a, { AccountState::MaybeInitialized }>>>;

#[derive(BorshDeserialize, BorshSerialize)]
pub struct P2WMessageDrvData {
    /// The key owning this message account
    pub message_owner: Pubkey,
    /// Index for keeping many accounts per owner
    pub id: u64,
}

impl<'a> Seeded<&P2WMessageDrvData> for P2WMessage<'a> {
    fn seeds(data: &P2WMessageDrvData) -> Vec<Vec<u8>> {
        vec![
            "p2w-message".as_bytes().to_vec(),
            data.message_owner.to_bytes().to_vec(),
            data.id.to_be_bytes().to_vec(),
        ]
    }
}

