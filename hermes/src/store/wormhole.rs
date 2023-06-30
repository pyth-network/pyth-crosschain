use {
    super::Store,
    anyhow::{
        anyhow,
        Result,
    },
    secp256k1::{
        ecdsa::{
            RecoverableSignature,
            RecoveryId,
        },
        Message,
        Secp256k1,
    },
    serde_wormhole::RawMessage,
    sha3::{
        Digest,
        Keccak256,
    },
    wormhole_sdk::{
        vaa::{
            Body,
            Header,
        },
        Vaa,
    },
};

/// A small wrapper around [u8; 20] guardian set key types.
#[derive(Eq, PartialEq, Clone, Hash, Debug)]
pub struct GuardianSet {
    pub keys: Vec<[u8; 20]>,
}

impl std::fmt::Display for GuardianSet {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[")?;
        for (i, key) in self.keys.iter().enumerate() {
            // Comma seperated printing of the keys using hex encoding.
            if i != 0 {
                write!(f, ", ")?;
            }

            write!(f, "{}", hex::encode(key))?;
        }
        write!(f, "]")
    }
}

/// BridgeData extracted from wormhole bridge account, due to no API.
#[derive(borsh::BorshDeserialize)]
#[allow(dead_code)]
pub struct BridgeData {
    pub guardian_set_index: u32,
    pub last_lamports:      u64,
    pub config:             BridgeConfig,
}

/// BridgeConfig extracted from wormhole bridge account, due to no API.
#[derive(borsh::BorshDeserialize)]
#[allow(dead_code)]
pub struct BridgeConfig {
    pub guardian_set_expiration_time: u32,
    pub fee:                          u64,
}

/// GuardianSetData extracted from wormhole bridge account, due to no API.
#[derive(borsh::BorshDeserialize)]
pub struct GuardianSetData {
    pub index:           u32,
    pub keys:            Vec<[u8; 20]>,
    pub creation_time:   u32,
    pub expiration_time: u32,
}

/// Verifies a VAA to ensure it is signed by the Wormhole guardian set.
pub async fn verify_vaa<'a>(
    store: &Store,
    vaa: Vaa<&'a RawMessage>,
) -> Result<Vaa<&'a RawMessage>> {
    let (header, body): (Header, Body<&RawMessage>) = vaa.into();
    let digest = body.digest()?;
    let guardian_set = store.guardian_set.read().await;
    let guardian_set = guardian_set
        .get(&header.guardian_set_index)
        .ok_or_else(|| {
            anyhow!(
                "Message signed by an unknown guardian set: {}",
                header.guardian_set_index
            )
        })?;

    let mut num_correct_signers = 0;
    for sig in header.signatures.iter() {
        let signer_id: usize = sig.index.into();

        let sig = sig.signature;

        // Recover the public key from ecdsa signature from [u8; 65] that has (v, r, s) format
        let recid = RecoveryId::from_i32(sig[64].into())?;

        let secp = Secp256k1::new();

        // To get the address we need to use the uncompressed public key
        let pubkey: &[u8; 65] = &secp
            .recover_ecdsa(
                &Message::from_slice(&digest.secp256k_hash)?,
                &RecoverableSignature::from_compact(&sig[..64], recid)?,
            )?
            .serialize_uncompressed();

        // The address is the last 20 bytes of the Keccak256 hash of the public key
        let mut keccak = Keccak256::new();
        keccak.update(&pubkey[1..]);
        let address: [u8; 32] = keccak.finalize().into();
        let address: [u8; 20] = address[address.len() - 20..].try_into()?;

        if guardian_set.keys.get(signer_id) == Some(&address) {
            num_correct_signers += 1;
        }
    }

    let quorum = (guardian_set.keys.len() * 2 + 2) / 3;
    if num_correct_signers < quorum {
        return Err(anyhow!(
            "Not enough correct signatures. Expected {:?}, received {:?}",
            quorum,
            num_correct_signers
        ));
    }

    Ok((header, body).into())
}
