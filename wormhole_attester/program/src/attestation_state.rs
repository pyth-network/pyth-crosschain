//! Implementation of per-symbol on-chain state. Currently used to
//! store latest successful attestation time for each price.

use {
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
    solana_program::{
        clock::UnixTimestamp,
        pubkey::Pubkey,
    },
    solitaire::{
        AccountOwner,
        AccountState,
        Data,
        Derive,
        Owned,
    },
    std::collections::BTreeMap,
};

/// On-chain state for a single price attestation
#[derive(BorshSerialize, BorshDeserialize)]
pub struct AttestationState {
    /// The last trading publish_time this attester saw
    pub last_attested_trading_publish_time: UnixTimestamp,
}

/// Top-level state gathering all known AttestationState values, keyed by price address.
#[derive(BorshSerialize, BorshDeserialize, Default)]
pub struct AttestationStateMap {
    pub entries: BTreeMap<Pubkey, AttestationState>,
}


impl Owned for AttestationStateMap {
    fn owner(&self) -> AccountOwner {
        AccountOwner::This
    }
}

pub type AttestationStateMapPDA<'b> = Derive<
    Data<'b, AttestationStateMap, { AccountState::MaybeInitialized }>,
    "p2w-attestation-state-v1",
>;
