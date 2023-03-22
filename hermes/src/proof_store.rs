use {
    crate::db::{
        Db,
        RequestTime,
        UnixTimestamp,
    },
    anyhow::Result,
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
    pyth_sdk::{
        PriceFeed,
        PriceIdentifier,
    },
    std::collections::HashMap,
    wormhole::VAA,
};


pub enum ProofUpdate {
    Vaa(VAA),
}

pub enum ProofType {
    BatchVaa,
}

// TODO: Is this the right type for the proof?
#[derive(Clone, Default, PartialEq, PartialOrd, Debug, BorshSerialize, BorshDeserialize)]
pub struct Proof(pub Vec<Vec<u8>>);


// TODO: We need to add more metadata to this struct.
#[derive(Clone, Default, PartialEq, Debug, BorshSerialize, BorshDeserialize)]
pub struct PriceInfo {
    pub price_feed:   PriceFeed,
    pub proof:        Proof,
    pub publish_time: UnixTimestamp,
}

#[derive(Clone, Default)]
pub struct PriceFeedsWithProof {
    pub price_feeds: HashMap<PriceIdentifier, PriceFeed>,
    pub proof:       Proof,
}


#[derive(Clone, Default)]
pub struct ProofStore<D: Db> {
    pub db: D,
}

impl<D: Db> ProofStore<D> {
    pub fn new(db: D) -> Self {
        Self { db }
    }

    // TODO: This should return the updated feeds so the subscribers can be notified.
    pub fn process_update(&mut self, update: ProofUpdate) -> Result<()> {
        Ok(())
    }

    pub fn get_price_feeds_with_proof(
        &self,
        proof_type: ProofType,
        price_id: PriceIdentifier,
        request_time: RequestTime,
    ) -> Result<PriceFeedsWithProof> {
        Ok(PriceFeedsWithProof::default())
    }
}
