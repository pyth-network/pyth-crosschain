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
        GuardianAddress,
        Vaa,
    },
};

/// Verifies a VAA to ensure it is signed by the Wormhole guardian set.
pub async fn verify_vaa<'a>(
    store: &Store,
    vaa: Vaa<&'a RawMessage>,
) -> Result<Vaa<&'a RawMessage>> {
    let (header, body): (Header, Body<&RawMessage>) = vaa.into();
    let digest = body.digest()?;

    let guardian_set = match store.guardian_set.read().await.as_ref() {
        Some(guardian_set) => guardian_set.clone(),
        None => {
            return Err(anyhow!("Guardian set is not initialized"));
        }
    };

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
        let address = GuardianAddress(address[address.len() - 20..].try_into()?);

        if guardian_set.get(signer_id) == Some(&address) {
            num_correct_signers += 1;
        }
    }

    let quorum = (guardian_set.len() * 2 + 2) / 3;
    if num_correct_signers < quorum {
        return Err(anyhow!(
            "Not enough correct signatures. Expected {:?}, received {:?}",
            quorum,
            num_correct_signers
        ));
    }

    Ok((header, body).into())
}
