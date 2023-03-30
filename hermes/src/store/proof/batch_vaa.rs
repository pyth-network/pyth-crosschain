use {
    crate::store::{
        storage::Key,
        PriceFeedsWithProof,
        RequestTime,
        State,
        StorageData,
        UnixTimestamp,
        UpdateData,
    },
    anyhow::{
        anyhow,
        Result,
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
    std::collections::{
        HashMap,
        HashSet,
    },
    wormhole::VAA,
};

// TODO: We need to add more metadata to this struct.
#[derive(Clone, Default, PartialEq, Debug)]
pub struct PriceInfo {
    pub price_feed:   PriceFeed,
    pub vaa_bytes:    Vec<u8>,
    pub publish_time: UnixTimestamp,
}


pub fn store_vaa_update(state: State, vaa_bytes: Vec<u8>) -> Result<()> {
    // FIXME: Vaa bytes might not be a valid Pyth BatchUpdate message nor originate from Our emitter.
    // We should check that.
    let vaa = VAA::from_bytes(&vaa_bytes)?;
    // Ideally this part would be in a separate function/module when we add more proof types.
    let batch_price_attestation = BatchPriceAttestation::deserialize(vaa.payload.as_slice())
        .map_err(|_| anyhow!("Failed to deserialize VAA"))?;

    for price_attestation in batch_price_attestation.price_attestations {
        let price_feed = price_attestation_to_price_feed(price_attestation);

        let publish_time = price_feed.get_price_unchecked().publish_time.try_into()?;

        let price_info = PriceInfo {
            price_feed,
            vaa_bytes: vaa_bytes.clone(),
            publish_time,
        };

        let key = Key::new(price_feed.id.to_bytes().to_vec());
        state.insert(key, publish_time, StorageData::BatchVaa(price_info))?;
    }
    Ok(())
}


pub fn get_price_feeds_with_proofs(
    state: State,
    price_ids: Vec<PriceIdentifier>,
    request_time: RequestTime,
) -> Result<PriceFeedsWithProof> {
    let mut price_feeds = HashMap::new();
    let mut vaas: HashSet<Vec<u8>> = HashSet::new();
    for price_id in price_ids {
        let key = Key::new(price_id.to_bytes().to_vec());
        let maybe_data = state.get(key, request_time.clone())?;

        match maybe_data {
            Some(StorageData::BatchVaa(price_info)) => {
                price_feeds.insert(price_info.price_feed.id, price_info.price_feed);
                vaas.insert(price_info.vaa_bytes);
            }
            None => {
                log::info!("No price feed found for price id: {:?}", price_id);
                return Err(anyhow!("No price feed found for price id: {:?}", price_id));
            }
        }
    }
    let proof = UpdateData {
        batch_vaa: vaas.into_iter().collect(),
    };
    Ok(PriceFeedsWithProof { price_feeds, proof })
}


/// Convert a PriceAttestation to a PriceFeed.
///
/// We cannot implmenet this function as From/Into trait because none of these types are defined in this crate.
/// Ideally we need to move this method to the wormhole_attester sdk crate or have our own implementation of PriceFeed.
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
