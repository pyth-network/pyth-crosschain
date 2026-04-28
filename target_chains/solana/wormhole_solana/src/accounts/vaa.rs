//! VAA type specific to Solana.
//!
//! Solana's VAA kind represents a VAA "after" it has been processed by the bridge, it differs in a
//! two minor ways specific to Solana:
//!
//! - The field order differs from the Wormhole VAA wire format.
//! - Rather than include Signatures directly, it has a Pubkey to a signature account.
//!
//! It forms the basis of both Message and VAA accounts on Solana, but is still trivially
//! convertible back to the core VAA type in the SDK.

use {
    super::Account,
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{account_info::AccountInfo, pubkey::Pubkey},
    wormhole::WormholeError,
};

#[derive(Debug, Eq, PartialEq, Clone)]
pub struct VAA {
    /// Header of the posted VAA
    pub vaa_version: u8,
    /// Level of consistency requested by the emitter
    pub consistency_level: u8,
    /// Time the vaa was submitted
    pub vaa_time: u32,
    /// Account where signatures are stored
    pub vaa_signature_account: Pubkey,
    /// Time the posted message was created
    pub submission_time: u32,
    /// Unique nonce for this message
    pub nonce: u32,
    /// Sequence number of this message
    pub sequence: u64,
    /// Emitter of the message
    pub emitter_chain: u16,
    /// Emitter of the message
    pub emitter_address: [u8; 32],
    /// Message payload
    pub payload: Vec<u8>,
}

impl BorshSerialize for VAA {
    fn serialize<W: std::io::Write>(&self, writer: &mut W) -> std::io::Result<()> {
        BorshSerialize::serialize(&self.vaa_version, writer)?;
        BorshSerialize::serialize(&self.consistency_level, writer)?;
        BorshSerialize::serialize(&self.vaa_time, writer)?;
        writer.write_all(self.vaa_signature_account.as_ref())?;
        BorshSerialize::serialize(&self.submission_time, writer)?;
        BorshSerialize::serialize(&self.nonce, writer)?;
        BorshSerialize::serialize(&self.sequence, writer)?;
        BorshSerialize::serialize(&self.emitter_chain, writer)?;
        BorshSerialize::serialize(&self.emitter_address, writer)?;
        BorshSerialize::serialize(&self.payload, writer)?;
        Ok(())
    }
}

impl BorshDeserialize for VAA {
    fn deserialize(buf: &mut &[u8]) -> std::io::Result<Self> {
        let vaa_version = u8::deserialize(buf)?;
        let consistency_level = u8::deserialize(buf)?;
        let vaa_time = u32::deserialize(buf)?;
        let pubkey_bytes = <[u8; 32]>::deserialize(buf)?;
        let vaa_signature_account = Pubkey::from(pubkey_bytes);
        let submission_time = u32::deserialize(buf)?;
        let nonce = u32::deserialize(buf)?;
        let sequence = u64::deserialize(buf)?;
        let emitter_chain = u16::deserialize(buf)?;
        let emitter_address = <[u8; 32]>::deserialize(buf)?;
        let payload = Vec::<u8>::deserialize(buf)?;
        Ok(VAA {
            vaa_version,
            consistency_level,
            vaa_time,
            vaa_signature_account,
            submission_time,
            nonce,
            sequence,
            emitter_chain,
            emitter_address,
            payload,
        })
    }
}

impl Account for VAA {
    type Seeds = [u8; 32];
    type Output = Pubkey;

    fn key(id: &Pubkey, vaa_hash: [u8; 32]) -> Pubkey {
        let (vaa, _) = Pubkey::find_program_address(&[b"PostedVAA", &vaa_hash], id);
        vaa
    }

    fn get(account: &AccountInfo) -> Result<Self, WormholeError> {
        VAA::deserialize(&mut &account.data.borrow()[..])
            .map_err(|_| WormholeError::DeserializeFailed)
    }
}
