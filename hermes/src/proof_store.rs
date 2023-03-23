use {
    crate::db::{
        Db,
        DbRecord,
        RequestTime,
        UnixTimestamp,
    },
    anyhow::{
        anyhow,
        Result,
    },
    borsh::{
        BorshDeserialize,
        BorshSerialize,
    },
    pyth_sdk::{
        Price,
        PriceFeed,
        PriceIdentifier,
    },
    pyth_wormhole_attester_sdk::{
        BatchPriceAttestation,
        PriceAttestation,
        PriceStatus,
    },
    serde::{
        Deserialize,
        Serialize,
    },
    std::{
        collections::{
            HashMap,
            HashSet,
        },
        ops::{
            Deref,
            DerefMut,
        },
    },
    wormhole::VAA,
};


pub enum ProofUpdate {
    Vaa(Vec<u8>),
}

pub enum ProofType {
    BatchVaa,
}

// TODO: Is this the right type for the proof?
#[derive(
    Clone,
    Default,
    PartialEq,
    PartialOrd,
    Debug,
    Serialize,
    Deserialize,
    BorshSerialize,
    BorshDeserialize,
)]
pub struct Proof(pub Vec<Vec<u8>>);

impl Deref for Proof {
    type Target = Vec<Vec<u8>>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Proof {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}


// TODO: We need to add more metadata to this struct.
#[derive(Clone, Default, PartialEq, Debug, BorshSerialize, BorshDeserialize)]
pub struct PriceInfo {
    pub price_feed:   PriceFeed,
    pub vaa_bytes:    Vec<u8>,
    pub publish_time: UnixTimestamp,
}

#[derive(Clone, Default, Serialize, Deserialize)]
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
        match update {
            ProofUpdate::Vaa(vaa_bytes) => {
                // FIXME: Vaa bytes might not be a valid Pyth BatchUpdate message nor originate from Our emitter. We should check that.
                let vaa = VAA::from_bytes(&vaa_bytes)?;
                // Ideally this part would be in a separate function/module when we add more proof types.
                let batch_price_attestation =
                    BatchPriceAttestation::deserialize(vaa.payload.as_slice())
                        .map_err(|_| anyhow!("Failed to deserialize VAA"))?;

                for price_attestation in batch_price_attestation.price_attestations {
                    let price_feed = price_attestation_to_price_feed(price_attestation);

                    let publish_time = price_feed.get_price_unchecked().publish_time.try_into()?;

                    let price_info = PriceInfo {
                        price_feed,
                        vaa_bytes: vaa_bytes.clone(),
                        publish_time,
                    };

                    let key = price_feed.id.to_bytes().to_vec();
                    let record = DbRecord {
                        time:  publish_time,
                        value: price_info.try_to_vec()?,
                    };
                    self.db.insert(&key, record)?;
                }
            }
        };
        Ok(())
    }

    pub fn get_price_feeds_with_proof(
        &self,
        proof_type: ProofType,
        price_ids: Vec<PriceIdentifier>,
        request_time: RequestTime,
    ) -> Result<PriceFeedsWithProof> {
        match proof_type {
            ProofType::BatchVaa => {
                let mut price_feeds = HashMap::new();
                let mut vaas: HashSet<Vec<u8>> = HashSet::new();
                for price_id in price_ids {
                    let key = price_id.to_bytes().to_vec();
                    let record = self.db.get(&key, request_time.clone())?;
                    if let Some(record) = record {
                        let price_info = PriceInfo::try_from_slice(&record)?;
                        price_feeds.insert(price_info.price_feed.id, price_info.price_feed);
                        vaas.insert(price_info.vaa_bytes);
                    } else {
                        log::info!("No price feed found for price id: {:?}", price_id);
                        return Err(anyhow!("No price feed found for price id: {:?}", price_id));
                    }
                }
                let proof = Proof(vaas.into_iter().collect());
                Ok(PriceFeedsWithProof { price_feeds, proof })
            }
        }
    }
}

///  This function converts a PriceAttestation to a PriceFeed.
///  We cannot implmenet this function as From/Into trait because none of these types are defined in this crate. Ideally we need to move
/// this method to the wormhole_attester sdk crate or have our own implementation of PriceFeed.
pub fn price_attestation_to_price_feed(price_attestation: PriceAttestation) -> PriceFeed {
    if price_attestation.status == PriceStatus::Trading {
        PriceFeed::new(
            // This conversion is done because the identifier on the wormhole_attester uses sdk v0.5.0 and this crate uses 0.7.0
            PriceIdentifier::new(price_attestation.price_id.to_bytes()),
            Price {
                price:        price_attestation.price,
                conf:         price_attestation.conf,
                publish_time: price_attestation.publish_time,
                expo:         price_attestation.expo,
            },
            Price {
                price:        price_attestation.ema_price,
                conf:         price_attestation.ema_conf,
                publish_time: price_attestation.publish_time,
                expo:         price_attestation.expo,
            },
        )
    } else {
        PriceFeed::new(
            PriceIdentifier::new(price_attestation.price_id.to_bytes()),
            Price {
                price:        price_attestation.prev_price,
                conf:         price_attestation.prev_conf,
                publish_time: price_attestation.prev_publish_time,
                expo:         price_attestation.expo,
            },
            Price {
                price:        price_attestation.ema_price,
                conf:         price_attestation.ema_conf,
                publish_time: price_attestation.prev_publish_time,
                expo:         price_attestation.expo,
            },
        )
    }
}
