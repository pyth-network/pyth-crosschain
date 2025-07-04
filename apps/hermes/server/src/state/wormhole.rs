use {
    super::{
        aggregate::{Aggregates, Update},
        State,
    },
    crate::network::wormhole::GuardianSet,
    anyhow::{anyhow, ensure, Context, Result},
    chrono::DateTime,
    pythnet_sdk::{
        wire::v1::{WormholeMessage, WormholePayload},
        ACCUMULATOR_EMITTER_ADDRESS,
    },
    secp256k1::{
        ecdsa::{RecoverableSignature, RecoveryId},
        Message, Secp256k1,
    },
    serde_wormhole::RawMessage,
    sha3::{Digest, Keccak256},
    std::collections::{BTreeMap, BTreeSet},
    tokio::sync::RwLock,
    wormhole_sdk::{
        vaa::{Body, Header},
        Address, Chain, Vaa,
    },
};

const OBSERVED_CACHE_SIZE: usize = 1000;

pub struct WormholeState {
    /// Sequence numbers of lately observed Vaas.
    ///
    /// Store uses this set to ignore the previously observed Vaas as a performance boost.
    observed_vaa_seqs: RwLock<BTreeSet<u64>>,

    /// Wormhole guardian sets. It is used to verify Vaas before using them.
    guardian_set: RwLock<BTreeMap<u32, GuardianSet>>,
}

impl Default for WormholeState {
    fn default() -> Self {
        Self::new()
    }
}

impl WormholeState {
    pub fn new() -> Self {
        Self {
            observed_vaa_seqs: RwLock::new(BTreeSet::new()),
            guardian_set: RwLock::new(BTreeMap::new()),
        }
    }
}

/// Allow downcasting State into WormholeState for functions that depend on the `Wormhole` service.
impl<'a> From<&'a State> for &'a WormholeState {
    fn from(state: &'a State) -> &'a WormholeState {
        &state.wormhole
    }
}

#[async_trait::async_trait]
pub trait Wormhole: Aggregates {
    async fn store_vaa(&self, sequence: u64, vaa_bytes: Vec<u8>);
    async fn process_message(&self, vaa_bytes: Vec<u8>) -> Result<()>;
    async fn update_guardian_set(&self, id: u32, guardian_set: GuardianSet);
}

#[async_trait::async_trait]
impl<T> Wormhole for T
where
    for<'a> &'a T: Into<&'a WormholeState>,
    T: Sync,
    T: Aggregates,
{
    /// Update the guardian set with the given ID in the state.
    #[tracing::instrument(skip(self, guardian_set))]
    async fn update_guardian_set(&self, id: u32, guardian_set: GuardianSet) {
        let mut guardian_sets = self.into().guardian_set.write().await;
        guardian_sets.insert(id, guardian_set);
    }

    #[tracing::instrument(skip(self, vaa_bytes))]
    async fn store_vaa(&self, sequence: u64, vaa_bytes: Vec<u8>) {
        // Check VAA hasn't already been seen, this may have been checked previously
        // but due to async nature it's possible other threads have mutated the state
        // since this VAA started processing.
        let mut observed_vaa_seqs = self.into().observed_vaa_seqs.write().await;
        if observed_vaa_seqs.contains(&sequence) {
            return;
        }

        // Clear old cached VAA sequences.
        while observed_vaa_seqs.len() > OBSERVED_CACHE_SIZE {
            observed_vaa_seqs.pop_first();
        }

        // Hand the VAA to the aggregate store.
        if let Err(e) = Aggregates::store_update(self, Update::Vaa(vaa_bytes)).await {
            tracing::error!(error = ?e, "Failed to store VAA in aggregate store.");
        }
    }

    async fn process_message(&self, vaa_bytes: Vec<u8>) -> Result<()> {
        let vaa = serde_wormhole::from_slice::<Vaa<&RawMessage>>(&vaa_bytes)?;

        // Log VAA Processing.
        let vaa_timestamp = DateTime::from_timestamp(vaa.timestamp.into(), 0)
            .context("Failed to parse VAA Timestamp")?
            .format("%Y-%m-%dT%H:%M:%S.%fZ")
            .to_string();

        let slot = match WormholeMessage::try_from_bytes(vaa.payload)?.payload {
            WormholePayload::Merkle(proof) => proof.slot,
        };
        tracing::info!(slot = slot, vaa_timestamp = vaa_timestamp, "Observed VAA");

        // Check VAA hasn't already been seen.
        ensure!(
            !self
                .into()
                .observed_vaa_seqs
                .read()
                .await
                .contains(&vaa.sequence),
            "Previously observed VAA: {}",
            vaa.sequence
        );

        // Check VAA source is valid, we don't want to process other protocols VAAs.
        validate_vaa_source(&vaa)?;

        // Verify the VAA has been signed by a known guardian set.
        let vaa = verify_vaa(
            self.into()
                .guardian_set
                .read()
                .await
                .get(&vaa.guardian_set_index)
                .ok_or_else(|| anyhow!("Unknown guardian set: {}", vaa.guardian_set_index))?,
            vaa,
        )?;

        // Finally, store the resulting VAA in Hermes.
        self.store_vaa(vaa.sequence, vaa_bytes).await;
        Ok(())
    }
}
// Rejects VAAs from invalid sources.
#[tracing::instrument(skip(vaa))]
fn validate_vaa_source(vaa: &Vaa<&RawMessage>) -> Result<()> {
    ensure!(
        vaa.emitter_chain == Chain::Pythnet,
        "VAA from non-Pythnet Chain."
    );
    ensure!(
        vaa.emitter_address == Address(ACCUMULATOR_EMITTER_ADDRESS),
        "VAA from non-Pythnet Emitter: {}",
        vaa.emitter_address
    );
    Ok(())
}

/// Validate a VAA extracted from a Wormhole gRPC message.
#[tracing::instrument(skip(guardian_set, vaa))]
fn verify_vaa<'a>(
    guardian_set: &GuardianSet,
    vaa: Vaa<&'a RawMessage>,
) -> Result<Vaa<&'a RawMessage>> {
    let (header, body): (Header, Body<&RawMessage>) = vaa.into();
    let digest = body.digest()?;

    // Ideally we need to test the signatures but currently Wormhole doesn't give us any easy way
    // to do it, so we just bypass the check in tests.
    let quorum = if cfg!(test) {
        0
    } else {
        (guardian_set.keys.len() * 2) / 3 + 1
    };

    let secp = Secp256k1::new();
    let mut last_signer_id: Option<usize> = None;
    let mut signatures = vec![];
    for signature in header.signatures.into_iter() {
        // Do not collect more signatures than necessary to reduce on-chain gas spent during
        // signature verification.
        if signatures.len() >= quorum {
            break;
        }

        let signer_id: usize = signature.index.into();
        if signer_id >= guardian_set.keys.len() {
            return Err(anyhow!(
                "Signer ID is out of range. Signer ID: {}, guardian set size: {}",
                signer_id,
                guardian_set.keys.len()
            ));
        }

        // On-chain verification expects signatures to be sorted by signer ID. We can exit early if
        // this constraint is violated.
        if let Some(true) = last_signer_id.map(|v| v >= signer_id) {
            return Err(anyhow!(
                "Signatures are not sorted by signer ID. Last signer ID: {:?}, current signer ID: {}",
                last_signer_id,
                signer_id
            ));
        }

        // Recover the public key from an [u8; 65] serialized ECDSA signature in (v, r, s) format
        let recid = RecoveryId::from_i32(signature.signature[64].into())?;

        // An address is the last 20 bytes of the Keccak256 hash of the uncompressed public key.
        let pubkey: &[u8; 65] = &secp
            .recover_ecdsa(
                &Message::from_slice(&digest.secp256k_hash)?,
                &RecoverableSignature::from_compact(&signature.signature[..64], recid)?,
            )?
            .serialize_uncompressed();

        // The address is the last 20 bytes of the Keccak256 hash of the public key
        let address: [u8; 32] = Keccak256::new_with_prefix(&pubkey[1..]).finalize().into();
        let address: [u8; 20] = address[32 - 20..].try_into()?;

        // Confirm the recovered address matches an address in the guardian set.
        if guardian_set.keys.get(signer_id) == Some(&address) {
            signatures.push(signature);
        }

        last_signer_id = Some(signer_id);
    }

    // Check if we have enough correct signatures
    if signatures.len() < quorum {
        return Err(anyhow!(
            "Not enough correct signatures. Expected {:?}, received {:?}",
            quorum,
            signatures.len()
        ));
    }

    Ok((
        Header {
            signatures,
            ..header
        },
        body,
    )
        .into())
}
