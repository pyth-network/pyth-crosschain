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
        Owned,
        Peel,
        Seeded,
    },
};

/// On-chain state for a single price attestation
#[derive(BorshSerialize, BorshDeserialize, Default)]
pub struct AttestationState {
    /// The last trading publish_time this attester saw
    pub last_attested_trading_publish_time: UnixTimestamp,
}

impl Owned for AttestationState {
    fn owner(&self) -> AccountOwner {
        AccountOwner::This
    }
}

pub struct AttestationStatePDA<'b>(
    pub Data<'b, AttestationState, { AccountState::MaybeInitialized }>,
);

impl Seeded<&Pubkey> for AttestationStatePDA<'_> {
    fn seeds(symbol_id: &Pubkey) -> Vec<Vec<u8>> {
        vec![
            "p2w-attestation-state-v1".as_bytes().to_vec(),
            symbol_id.to_bytes().to_vec(),
        ]
    }
}

impl<'a, 'b: 'a> Peel<'a, 'b> for AttestationStatePDA<'b> {
    fn peel<I>(ctx: &mut solitaire::Context<'a, 'b, I>) -> solitaire::Result<Self>
    where
        Self: Sized,
    {
        Ok(Self(Data::peel(ctx)?))
    }

    fn persist(&self, program_id: &Pubkey) -> solitaire::Result<()> {
        self.0.persist(program_id)
    }
}
