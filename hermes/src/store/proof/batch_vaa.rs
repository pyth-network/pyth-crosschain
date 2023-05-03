use {
    crate::store::{
        storage::{
            Key,
            StorageData,
        },
        RequestTime,
        State,
        UnixTimestamp,
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
    std::{
        collections::{
            HashMap,
            HashSet,
        },
        time::{
            SystemTime,
            UNIX_EPOCH,
        },
    },
    wormhole::VAA,
};

// TODO: We need to add more metadata to this struct.
#[derive(Clone, Default, PartialEq, Debug)]
pub struct PriceInfo {
    pub price_feed:       PriceFeed,
    pub vaa_bytes:        Vec<u8>,
    pub publish_time:     UnixTimestamp,
    pub emitter_chain:    u16,
    pub attestation_time: UnixTimestamp,
    pub receive_time:     UnixTimestamp,
    pub sequence_number:  u64,
}

#[derive(Clone, Default)]
pub struct PriceInfosWithUpdateData {
    pub price_infos: HashMap<PriceIdentifier, PriceInfo>,
    pub update_data: Vec<Vec<u8>>,
}

pub fn store_vaa_update(state: State, vaa_bytes: Vec<u8>) -> Result<Vec<PriceIdentifier>> {
    // FIXME: Vaa bytes might not be a valid Pyth BatchUpdate message nor originate from Our emitter.
    // We should check that.
    // FIXME: We receive multiple vaas for the same update (due to different signedVAAs). We need
    // to drop them.
    let vaa = VAA::from_bytes(&vaa_bytes)?;
    let batch_price_attestation = BatchPriceAttestation::deserialize(vaa.payload.as_slice())
        .map_err(|_| anyhow!("Failed to deserialize VAA"))?;

    let mut updated_price_feed_ids = Vec::new();

    for price_attestation in batch_price_attestation.price_attestations {
        let price_feed = price_attestation_to_price_feed(price_attestation.clone());

        let publish_time = price_feed.get_price_unchecked().publish_time.try_into()?;

        let price_info = PriceInfo {
            price_feed,
            vaa_bytes: vaa_bytes.clone(),
            publish_time,
            emitter_chain: vaa.emitter_chain.into(),
            attestation_time: price_attestation.attestation_time.try_into()?,
            receive_time: SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs(),
            sequence_number: vaa.sequence,
        };

        let key = Key::BatchVaa(price_feed.id);
        state.insert(key, publish_time, StorageData::BatchVaa(price_info))?;

        // FIXME: Only add price feed if it's newer
        // or include whether it's newer or not in the vector
        updated_price_feed_ids.push(price_feed.id);
    }

    Ok(updated_price_feed_ids)
}


pub fn get_price_infos_with_update_data(
    state: State,
    price_ids: Vec<PriceIdentifier>,
    request_time: RequestTime,
) -> Result<PriceInfosWithUpdateData> {
    let mut price_infos = HashMap::new();
    let mut vaas: HashSet<Vec<u8>> = HashSet::new();
    for price_id in price_ids {
        let key = Key::BatchVaa(price_id);
        let maybe_data = state.get(key, request_time.clone())?;

        match maybe_data {
            Some(StorageData::BatchVaa(price_info)) => {
                vaas.insert(price_info.vaa_bytes.clone());
                price_infos.insert(price_id, price_info);
            }
            None => {
                return Err(anyhow!("No price feed found for price id: {:?}", price_id));
            }
        }
    }
    let update_data: Vec<Vec<u8>> = vaas.into_iter().collect();
    Ok(PriceInfosWithUpdateData {
        price_infos,
        update_data,
    })
}


pub fn get_price_feed_ids(state: State) -> Vec<PriceIdentifier> {
    // Currently we have only one type and filter map is not necessary.
    // But we might have more types in the future.
    #[allow(clippy::unnecessary_filter_map)]
    state
        .keys()
        .into_iter()
        .filter_map(|key| match key {
            Key::BatchVaa(price_id) => Some(price_id),
        })
        .collect()
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
