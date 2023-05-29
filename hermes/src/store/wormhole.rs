use {
    super::{
        proof::wormhole_merkle::WormholeMerkleProof,
        Store,
    },
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
    wormhole_sdk::{
        vaa::{
            Body,
            Header,
        },
        GuardianAddress,
        Vaa,
    },
};

#[derive(Clone, Debug, PartialEq)]
pub enum WormholePayload {
    Merkle(WormholeMerkleProof),
}

impl WormholePayload {
    pub fn try_from_bytes(bytes: &[u8], vaa_bytes: &[u8]) -> Result<Self> {
        if bytes.len() != 37 {
            return Err(anyhow!("Invalid message length"));
        }

        // TODO: Use byte string literals for this check
        let magic = u32::from_be_bytes(bytes[0..4].try_into()?);
        if magic != 0x41555756u32 {
            return Err(anyhow!("Invalid magic"));
        }

        let message_type = u8::from_be_bytes(bytes[4..5].try_into()?);

        if message_type != 0 {
            return Err(anyhow!("Invalid message type"));
        }

        let slot = u64::from_be_bytes(bytes[5..13].try_into()?);
        let ring_size = u32::from_be_bytes(bytes[13..17].try_into()?);
        let root_digest = bytes[17..37].try_into()?;


        Ok(Self::Merkle(WormholeMerkleProof {
            root: root_digest,
            slot,
            ring_size,
            vaa: vaa_bytes.to_vec(),
        }))
    }
}

/// Parses and verifies a VAA to ensure it is signed by the Wormhole guardian set.
pub async fn parse_and_verify_vaa<'a>(
    store: &Store,
    vaa_bytes: &'a [u8],
) -> Result<Body<&'a RawMessage>> {
    let vaa = serde_wormhole::from_slice::<Vaa<&serde_wormhole::RawMessage>>(vaa_bytes)?;
    let (header, body): (Header, Body<&RawMessage>) = vaa.into();
    let digest = body.digest()?;

    let mut num_correct_signers = 0;
    for sig in header.signatures.iter() {
        let signer_id: usize = sig.index.into();
        let sig = sig.signature;

        let recid = RecoveryId::from_i32(sig[64].into())?;

        // Recover the public key from ecdsa signature from [u8; 65] that has (v, r, s) format
        let secp = Secp256k1::new();
        let pubkey = &secp
            .recover_ecdsa(
                &Message::from_slice(&digest.secp256k_hash)?,
                &RecoverableSignature::from_compact(&sig[..64], recid)?,
            )?
            .serialize();

        let address = GuardianAddress(pubkey[pubkey.len() - 20..].try_into()?);

        if let Some(guardian_set) = store.guardian_set.read().await.as_ref() {
            if guardian_set.get(signer_id) == Some(&address) {
                num_correct_signers += 1;
            }
        }
    }

    if num_correct_signers < header.signatures.len() * 2 / 3 {
        return Err(anyhow!("Not enough correct signatures"));
    }

    Ok(body)
}
