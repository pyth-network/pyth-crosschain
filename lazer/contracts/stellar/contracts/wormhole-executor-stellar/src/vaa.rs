use soroban_sdk::{contracttype, Bytes, BytesN, Env, Vec};

use crate::error::ContractError;
use crate::guardian;

/// Size of a single guardian signature entry in the VAA:
/// 1 (guardian_index) + 64 (signature r||s) + 1 (recovery_id) = 66 bytes
const SIGNATURE_ENTRY_SIZE: usize = 66;

/// Offset where the VAA body begins, after the fixed header and signatures.
/// 1 (version) + 4 (guardian_set_index) + 1 (num_signatures)
const HEADER_SIZE: usize = 6;

/// Minimum body size: 4 (timestamp) + 4 (nonce) + 2 (emitter_chain) +
/// 32 (emitter_address) + 8 (sequence) + 1 (consistency_level) = 51 bytes
const MIN_BODY_SIZE: usize = 51;

/// A parsed Wormhole VAA guardian signature.
#[contracttype]
#[derive(Clone, Debug)]
pub struct GuardianSignature {
    pub guardian_index: u32,
    pub signature: BytesN<64>,
    pub recovery_id: u32,
}

/// The parsed body of a Wormhole VAA.
#[derive(Clone, Debug)]
pub struct VaaBody {
    pub timestamp: u32,
    pub nonce: u32,
    pub emitter_chain: u16,
    pub emitter_address: BytesN<32>,
    pub sequence: u64,
    pub consistency_level: u8,
    pub payload: Bytes,
}

/// A fully parsed Wormhole VAA.
#[derive(Clone, Debug)]
pub struct Vaa {
    pub guardian_set_index: u32,
    pub signatures: Vec<GuardianSignature>,
    pub body: VaaBody,
    /// Raw body bytes for hashing/verification.
    pub body_bytes: Bytes,
}

/// Helper to read a byte from Soroban Bytes at a given index.
fn get_byte(data: &Bytes, index: usize) -> u8 {
    data.get(index as u32).expect("index out of bounds")
}

/// Parse a raw Wormhole VAA from bytes.
///
/// The VAA binary format:
/// - Version (1 byte, must be 1)
/// - Guardian set index (BE u32)
/// - Number of signatures (1 byte)
/// - For each signature: guardian_index (1 byte), signature (64 bytes r||s), recovery_id (1 byte)
/// - Body: timestamp (BE u32), nonce (BE u32), emitter_chain (BE u16),
///   emitter_address (32 bytes), sequence (BE u64), consistency_level (1 byte), payload (rest)
pub fn parse_vaa(env: &Env, data: &Bytes) -> Result<Vaa, ContractError> {
    let len = data.len() as usize;

    if len < HEADER_SIZE {
        return Err(ContractError::TruncatedData);
    }

    // Version
    let version = get_byte(data, 0);
    if version != 1 {
        return Err(ContractError::InvalidVaaVersion);
    }

    // Guardian set index (BE u32)
    let guardian_set_index = ((get_byte(data, 1) as u32) << 24)
        | ((get_byte(data, 2) as u32) << 16)
        | ((get_byte(data, 3) as u32) << 8)
        | (get_byte(data, 4) as u32);

    // Number of signatures
    let num_signatures = get_byte(data, 5) as usize;

    let body_offset = HEADER_SIZE + num_signatures * SIGNATURE_ENTRY_SIZE;
    if len < body_offset + MIN_BODY_SIZE {
        return Err(ContractError::TruncatedData);
    }

    // Parse signatures
    let mut signatures: Vec<GuardianSignature> = Vec::new(env);
    for i in 0..num_signatures {
        let sig_offset = HEADER_SIZE + i * SIGNATURE_ENTRY_SIZE;
        let guardian_index = get_byte(data, sig_offset) as u32;

        // Extract 64-byte signature (r || s)
        let mut sig_bytes: [u8; 64] = [0u8; 64];
        for j in 0..64 {
            sig_bytes[j] = get_byte(data, sig_offset + 1 + j);
        }
        let signature = BytesN::from_array(env, &sig_bytes);

        let recovery_id = get_byte(data, sig_offset + 65) as u32;

        signatures.push_back(GuardianSignature {
            guardian_index,
            signature,
            recovery_id,
        });
    }

    // Extract body bytes (everything from body_offset to end)
    let body_bytes = data.slice(body_offset as u32..len as u32);

    // Parse body fields
    let timestamp = ((get_byte(data, body_offset) as u32) << 24)
        | ((get_byte(data, body_offset + 1) as u32) << 16)
        | ((get_byte(data, body_offset + 2) as u32) << 8)
        | (get_byte(data, body_offset + 3) as u32);

    let nonce = ((get_byte(data, body_offset + 4) as u32) << 24)
        | ((get_byte(data, body_offset + 5) as u32) << 16)
        | ((get_byte(data, body_offset + 6) as u32) << 8)
        | (get_byte(data, body_offset + 7) as u32);

    let emitter_chain = ((get_byte(data, body_offset + 8) as u16) << 8)
        | (get_byte(data, body_offset + 9) as u16);

    let mut emitter_addr: [u8; 32] = [0u8; 32];
    for j in 0..32 {
        emitter_addr[j] = get_byte(data, body_offset + 10 + j);
    }
    let emitter_address = BytesN::from_array(env, &emitter_addr);

    let seq_offset = body_offset + 42;
    let sequence = ((get_byte(data, seq_offset) as u64) << 56)
        | ((get_byte(data, seq_offset + 1) as u64) << 48)
        | ((get_byte(data, seq_offset + 2) as u64) << 40)
        | ((get_byte(data, seq_offset + 3) as u64) << 32)
        | ((get_byte(data, seq_offset + 4) as u64) << 24)
        | ((get_byte(data, seq_offset + 5) as u64) << 16)
        | ((get_byte(data, seq_offset + 6) as u64) << 8)
        | (get_byte(data, seq_offset + 7) as u64);

    let consistency_level = get_byte(data, seq_offset + 8);

    let payload_offset = (seq_offset + 9) as u32;
    let payload = if payload_offset < len as u32 {
        data.slice(payload_offset..len as u32)
    } else {
        Bytes::new(env)
    };

    Ok(Vaa {
        guardian_set_index,
        signatures,
        body: VaaBody {
            timestamp,
            nonce,
            emitter_chain,
            emitter_address,
            sequence,
            consistency_level,
            payload,
        },
        body_bytes,
    })
}

/// Verify a parsed VAA against the stored guardian set.
///
/// This function:
/// 1. Checks the guardian_set_index matches the stored index.
/// 2. Computes the Wormhole double-hash: `keccak256(keccak256(body))`.
/// 3. For each signature, recovers the signer via `secp256k1_recover`.
/// 4. Derives the Ethereum address from the recovered public key.
/// 5. Checks the address matches the stored guardian at the given index.
/// 6. Verifies quorum (2/3 + 1 of guardians have valid signatures).
/// 7. Checks for duplicate guardian indices.
pub fn verify_vaa(env: &Env, vaa: &Vaa) -> Result<(), ContractError> {
    let stored_index = guardian::get_guardian_set_index(env);
    if vaa.guardian_set_index != stored_index {
        return Err(ContractError::InvalidGuardianSetIndex);
    }

    let guardian_set = guardian::get_guardian_set(env);
    let num_guardians = guardian_set.len();
    let required = guardian::quorum(num_guardians);

    let num_sigs = vaa.signatures.len();
    if num_sigs < required {
        return Err(ContractError::NoQuorum);
    }

    // Wormhole double-hash: keccak256(keccak256(body_bytes))
    let body_hash = env.crypto().keccak256(&vaa.body_bytes);
    let digest = env.crypto().keccak256(&Bytes::from_slice(env, &body_hash.to_array()));

    // Track which guardian indices have been seen to detect duplicates.
    // Use a simple approach: check ascending order (same as EVM).
    let mut last_index: Option<u32> = None;

    for i in 0..num_sigs {
        let sig = vaa.signatures.get(i).unwrap();
        let gi = sig.guardian_index;

        // Check ascending order (also prevents duplicates).
        if let Some(prev) = last_index {
            if gi <= prev {
                return Err(ContractError::DuplicateGuardianSignature);
            }
        }
        last_index = Some(gi);

        // Check guardian index is in bounds.
        if gi >= num_guardians {
            return Err(ContractError::InvalidGuardianIndex);
        }

        // Recover the public key from the signature.
        let recovered_pubkey = env.crypto().secp256k1_recover(
            &digest,
            &sig.signature,
            sig.recovery_id,
        );

        // Derive Ethereum address from the recovered uncompressed public key.
        let recovered_addr = guardian::eth_address_from_pubkey(env, &recovered_pubkey);

        // Check against stored guardian address.
        let expected_addr = guardian_set.get(gi).unwrap();
        if recovered_addr != expected_addr {
            return Err(ContractError::GuardianSignatureMismatch);
        }
    }

    Ok(())
}

/// Parse and verify a VAA in one step.
pub fn parse_and_verify_vaa(env: &Env, data: &Bytes) -> Result<Vaa, ContractError> {
    let vaa = parse_vaa(env, data)?;
    verify_vaa(env, &vaa)?;
    Ok(vaa)
}

#[cfg(test)]
mod tests {
    extern crate alloc;

    use super::*;
    use soroban_sdk::Env;

    fn vec_to_bytes(env: &Env, v: &[u8]) -> Bytes {
        Bytes::from_slice(env, v)
    }

    fn build_body_vec(
        timestamp: u32,
        nonce: u32,
        emitter_chain: u16,
        emitter_address: &[u8; 32],
        sequence: u64,
        consistency_level: u8,
        payload: &[u8],
    ) -> alloc::vec::Vec<u8> {
        let mut body = alloc::vec::Vec::new();
        body.extend_from_slice(&timestamp.to_be_bytes());
        body.extend_from_slice(&nonce.to_be_bytes());
        body.extend_from_slice(&emitter_chain.to_be_bytes());
        body.extend_from_slice(emitter_address);
        body.extend_from_slice(&sequence.to_be_bytes());
        body.push(consistency_level);
        body.extend_from_slice(payload);
        body
    }

    fn build_full_vaa_vec(
        guardian_set_index: u32,
        signatures: &[(u8, &[u8; 64], u8)], // (guardian_index, sig, recovery_id)
        body: &[u8],
    ) -> alloc::vec::Vec<u8> {
        let mut vaa = alloc::vec::Vec::new();
        vaa.push(1u8); // version
        vaa.extend_from_slice(&guardian_set_index.to_be_bytes());
        vaa.push(signatures.len() as u8);
        for (guardian_index, sig, recovery_id) in signatures {
            vaa.push(*guardian_index);
            vaa.extend_from_slice(&sig[..]);
            vaa.push(*recovery_id);
        }
        vaa.extend_from_slice(body);
        vaa
    }

    #[test]
    fn test_parse_minimal_vaa_no_signatures() {
        let env = Env::default();
        let emitter_address = [0xABu8; 32];
        let payload = [0x01, 0x02, 0x03, 0x04];

        let body = build_body_vec(1000, 42, 1, &emitter_address, 99, 32, &payload);
        let vaa_raw = build_full_vaa_vec(0, &[], &body);
        let vaa_bytes = vec_to_bytes(&env, &vaa_raw);

        let vaa = parse_vaa(&env, &vaa_bytes).unwrap();

        assert_eq!(vaa.guardian_set_index, 0);
        assert_eq!(vaa.signatures.len(), 0);
        assert_eq!(vaa.body.timestamp, 1000);
        assert_eq!(vaa.body.nonce, 42);
        assert_eq!(vaa.body.emitter_chain, 1);
        assert_eq!(
            vaa.body.emitter_address,
            BytesN::from_array(&env, &emitter_address)
        );
        assert_eq!(vaa.body.sequence, 99);
        assert_eq!(vaa.body.consistency_level, 32);
        assert_eq!(vaa.body.payload, vec_to_bytes(&env, &payload));
    }

    #[test]
    fn test_parse_vaa_with_signatures() {
        let env = Env::default();
        let emitter_address = [0x01u8; 32];
        let payload = [0xDE, 0xAD];

        let sig1 = [0x11u8; 64];
        let sig2 = [0x22u8; 64];

        let body = build_body_vec(2000, 0, 26, &emitter_address, 500, 15, &payload);
        let vaa_raw = build_full_vaa_vec(4, &[(0, &sig1, 0), (1, &sig2, 1)], &body);
        let vaa_bytes = vec_to_bytes(&env, &vaa_raw);

        let vaa = parse_vaa(&env, &vaa_bytes).unwrap();

        assert_eq!(vaa.guardian_set_index, 4);
        assert_eq!(vaa.signatures.len(), 2);

        let s0 = vaa.signatures.get(0).unwrap();
        assert_eq!(s0.guardian_index, 0);
        assert_eq!(s0.signature, BytesN::from_array(&env, &sig1));
        assert_eq!(s0.recovery_id, 0);

        let s1 = vaa.signatures.get(1).unwrap();
        assert_eq!(s1.guardian_index, 1);
        assert_eq!(s1.signature, BytesN::from_array(&env, &sig2));
        assert_eq!(s1.recovery_id, 1);

        assert_eq!(vaa.body.timestamp, 2000);
        assert_eq!(vaa.body.emitter_chain, 26);
        assert_eq!(vaa.body.sequence, 500);
    }

    #[test]
    fn test_parse_vaa_invalid_version() {
        let env = Env::default();
        let emitter_address = [0u8; 32];
        let body = build_body_vec(0, 0, 0, &emitter_address, 0, 0, &[]);
        let mut vaa_raw = build_full_vaa_vec(0, &[], &body);
        vaa_raw[0] = 2; // invalid version
        let vaa_bytes = vec_to_bytes(&env, &vaa_raw);

        let result = parse_vaa(&env, &vaa_bytes);
        assert_eq!(result.err(), Some(ContractError::InvalidVaaVersion));
    }

    #[test]
    fn test_parse_vaa_truncated_header() {
        let env = Env::default();
        let vaa_bytes = vec_to_bytes(&env, &[1, 0, 0]);

        let result = parse_vaa(&env, &vaa_bytes);
        assert_eq!(result.err(), Some(ContractError::TruncatedData));
    }

    #[test]
    fn test_parse_vaa_truncated_body() {
        let env = Env::default();
        let mut raw = alloc::vec::Vec::new();
        raw.push(1u8); // version
        raw.extend_from_slice(&0u32.to_be_bytes());
        raw.push(0u8); // num_signatures
        raw.extend_from_slice(&[0u8; 10]); // too short body
        let vaa_bytes = vec_to_bytes(&env, &raw);

        let result = parse_vaa(&env, &vaa_bytes);
        assert_eq!(result.err(), Some(ContractError::TruncatedData));
    }

    #[test]
    fn test_parse_vaa_truncated_signatures() {
        let env = Env::default();
        let mut raw = alloc::vec::Vec::new();
        raw.push(1u8); // version
        raw.extend_from_slice(&0u32.to_be_bytes());
        raw.push(1u8); // num_signatures = 1 but no sig data
        raw.extend_from_slice(&[0u8; 51]); // minimal body (but sig space missing)
        let vaa_bytes = vec_to_bytes(&env, &raw);

        let result = parse_vaa(&env, &vaa_bytes);
        assert_eq!(result.err(), Some(ContractError::TruncatedData));
    }

    #[test]
    fn test_parse_vaa_empty_payload() {
        let env = Env::default();
        let emitter_address = [0xFFu8; 32];

        let body = build_body_vec(999, 1, 2, &emitter_address, 42, 200, &[]);
        let vaa_raw = build_full_vaa_vec(0, &[], &body);
        let vaa_bytes = vec_to_bytes(&env, &vaa_raw);

        let vaa = parse_vaa(&env, &vaa_bytes).unwrap();

        assert_eq!(vaa.body.payload.len(), 0);
        assert_eq!(vaa.body.consistency_level, 200);
    }

    #[test]
    fn test_parse_vaa_large_guardian_set_index() {
        let env = Env::default();
        let emitter_address = [0u8; 32];

        let body = build_body_vec(0, 0, 0, &emitter_address, 0, 0, &[]);
        let vaa_raw = build_full_vaa_vec(0xFFFF_FFFF, &[], &body);
        let vaa_bytes = vec_to_bytes(&env, &vaa_raw);

        let vaa = parse_vaa(&env, &vaa_bytes).unwrap();
        assert_eq!(vaa.guardian_set_index, 0xFFFF_FFFF);
    }

    #[test]
    fn test_parse_vaa_large_sequence() {
        let env = Env::default();
        let emitter_address = [0u8; 32];

        let body = build_body_vec(0, 0, 0, &emitter_address, u64::MAX, 0, &[]);
        let vaa_raw = build_full_vaa_vec(0, &[], &body);
        let vaa_bytes = vec_to_bytes(&env, &vaa_raw);

        let vaa = parse_vaa(&env, &vaa_bytes).unwrap();
        assert_eq!(vaa.body.sequence, u64::MAX);
    }

    #[test]
    fn test_parse_vaa_body_bytes_match() {
        let env = Env::default();
        let emitter_address = [0x42u8; 32];
        let payload = [0x01, 0x02, 0x03];

        let body = build_body_vec(100, 200, 3, &emitter_address, 300, 1, &payload);
        let vaa_raw = build_full_vaa_vec(0, &[], &body);
        let vaa_bytes = vec_to_bytes(&env, &vaa_raw);

        let vaa = parse_vaa(&env, &vaa_bytes).unwrap();

        let expected_body_bytes = vec_to_bytes(&env, &body);
        assert_eq!(vaa.body_bytes, expected_body_bytes);
    }

    /// Test parsing a VAA with a governance-style payload (simulating a
    /// Wormhole guardian set upgrade message).
    #[test]
    fn test_parse_vaa_governance_payload() {
        let env = Env::default();

        // Governance emitter address: 32 bytes with 0x04 at the end
        let mut emitter_address = [0u8; 32];
        emitter_address[31] = 0x04;

        // Construct a PTGM-style payload:
        // "Core" (0x00000000436f7265) + action 2 (guardian set upgrade) + chain 0 +
        // new guardian set index (1) + num guardians (1) + guardian key (20 bytes)
        let mut payload = alloc::vec::Vec::new();
        // module "Core" padded to 32 bytes
        payload.extend_from_slice(&[0u8; 28]);
        payload.extend_from_slice(b"Core");
        // action = 2 (guardian set upgrade)
        payload.push(2);
        // target chain = 0 (all chains)
        payload.extend_from_slice(&0u16.to_be_bytes());
        // new guardian set index
        payload.extend_from_slice(&1u32.to_be_bytes());
        // num guardians = 1
        payload.push(1);
        // guardian ethereum address (20 bytes)
        payload.extend_from_slice(&[0xBEu8; 20]);

        let sig = [0xAAu8; 64];
        let body = build_body_vec(1, 1, 1, &emitter_address, 1, 0, &payload);
        let vaa_raw = build_full_vaa_vec(0, &[(0, &sig, 0)], &body);
        let vaa_bytes = vec_to_bytes(&env, &vaa_raw);

        let vaa = parse_vaa(&env, &vaa_bytes).unwrap();

        assert_eq!(vaa.guardian_set_index, 0);
        assert_eq!(vaa.signatures.len(), 1);
        assert_eq!(vaa.body.timestamp, 1);
        assert_eq!(vaa.body.nonce, 1);
        assert_eq!(vaa.body.emitter_chain, 1);
        assert_eq!(vaa.body.sequence, 1);
        assert_eq!(vaa.body.consistency_level, 0);
        assert_eq!(
            vaa.body.emitter_address,
            BytesN::from_array(&env, &emitter_address)
        );
        assert!(vaa.body.payload.len() > 0);
    }

    /// Test parsing a VAA with many signatures (simulating a full guardian quorum).
    #[test]
    fn test_parse_vaa_13_signatures() {
        let env = Env::default();
        let emitter_address = [0x55u8; 32];
        let payload = [0xCA, 0xFE, 0xBA, 0xBE];

        // Build 13 unique signatures (2/3 + 1 of 19 guardians)
        let mut sigs: alloc::vec::Vec<(u8, &[u8; 64], u8)> = alloc::vec::Vec::new();
        let sig_data: alloc::vec::Vec<[u8; 64]> = (0u8..13)
            .map(|i| {
                let mut s = [0u8; 64];
                s[0] = i;
                s[63] = i;
                s
            })
            .collect();
        for i in 0..13u8 {
            sigs.push((i, &sig_data[i as usize], i % 2));
        }

        let body = build_body_vec(
            1700000000,
            12345,
            1,
            &emitter_address,
            9999,
            32,
            &payload,
        );
        let vaa_raw = build_full_vaa_vec(4, &sigs, &body);
        let vaa_bytes = vec_to_bytes(&env, &vaa_raw);

        let vaa = parse_vaa(&env, &vaa_bytes).unwrap();

        assert_eq!(vaa.guardian_set_index, 4);
        assert_eq!(vaa.signatures.len(), 13);

        for i in 0..13u32 {
            let s = vaa.signatures.get(i).unwrap();
            assert_eq!(s.guardian_index, i);
            assert_eq!(s.recovery_id, i % 2);
        }

        assert_eq!(vaa.body.timestamp, 1700000000);
        assert_eq!(vaa.body.sequence, 9999);
        assert_eq!(vaa.body.payload, vec_to_bytes(&env, &payload));
    }

    #[test]
    fn test_parse_vaa_version_zero() {
        let env = Env::default();
        let emitter_address = [0u8; 32];
        let body = build_body_vec(0, 0, 0, &emitter_address, 0, 0, &[]);
        let mut vaa_raw = build_full_vaa_vec(0, &[], &body);
        vaa_raw[0] = 0; // version 0
        let vaa_bytes = vec_to_bytes(&env, &vaa_raw);

        let result = parse_vaa(&env, &vaa_bytes);
        assert_eq!(result.err(), Some(ContractError::InvalidVaaVersion));
    }

    #[test]
    fn test_parse_vaa_empty_input() {
        let env = Env::default();
        let vaa_bytes = Bytes::new(&env);

        let result = parse_vaa(&env, &vaa_bytes);
        assert_eq!(result.err(), Some(ContractError::TruncatedData));
    }

    /// Decode a hex string (without 0x prefix) into a Vec<u8>.
    fn hex_decode(hex: &str) -> alloc::vec::Vec<u8> {
        assert!(hex.len() % 2 == 0, "hex string must have even length");
        (0..hex.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
            .collect()
    }

    // Real mainnet guardian set upgrade VAA #0 (guardian_set_index=0, 1 signature).
    // Source: target_chains/ton/contracts/tests/utils/wormhole.ts MAINNET_UPGRADE_VAAS[0]
    const REAL_VAA_0: &str = "010000000001007ac31b282c2aeeeb37f3385ee0de5f8e421d30b9e5ae8ba3d4375c1c77a86e77159bb697d9c456d6f8c02d22a94b1279b65b0d6a9957e7d3857423845ac758e300610ac1d2000000030001000000000000000000000000000000000000000000000000000000000000000400000000000005390000000000000000000000000000000000000000000000000000000000436f7265020000000000011358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cdeb5f7389fa26941519f0863349c223b73a6ddee774a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";

    // Real mainnet guardian set upgrade VAA #1 (guardian_set_index=1, 13 signatures).
    const REAL_VAA_1: &str = "01000000010d0012e6b39c6da90c5dfd3c228edbb78c7a4c97c488ff8a346d161a91db067e51d638c17216f368aa9bdf4836b8645a98018ca67d2fec87d769cabfdf2406bf790a0002ef42b288091a670ef3556596f4f47323717882881eaf38e03345078d07a156f312b785b64dae6e9a87e3d32872f59cb1931f728cecf511762981baf48303668f0103cef2616b84c4e511ff03329e0853f1bd7ee9ac5ba71d70a4d76108bddf94f69c2a8a84e4ee94065e8003c334e899184943634e12043d0dda78d93996da073d190104e76d166b9dac98f602107cc4b44ac82868faf00b63df7d24f177aa391e050902413b71046434e67c770b19aecdf7fce1d1435ea0be7262e3e4c18f50ddc8175c0105d9450e8216d741e0206a50f93b750a47e0a258b80eb8fed1314cc300b3d905092de25cd36d366097b7103ae2d184121329ba3aa2d7c6cc53273f11af14798110010687477c8deec89d36a23e7948feb074df95362fc8dcbd8ae910ac556a1dee1e755c56b9db5d710c940938ed79bc1895a3646523a58bc55f475a23435a373ecfdd0107fb06734864f79def4e192497362513171530daea81f07fbb9f698afe7e66c6d44db21323144f2657d4a5386a954bb94eef9f64148c33aef6e477eafa2c5c984c01088769e82216310d1827d9bd48645ec23e90de4ef8a8de99e2d351d1df318608566248d80cdc83bdcac382b3c30c670352be87f9069aab5037d0b747208eae9c650109e9796497ff9106d0d1c62e184d83716282870cef61a1ee13d6fc485b521adcce255c96f7d1bca8d8e7e7d454b65783a830bddc9d94092091a268d311ecd84c26010c468c9fb6d41026841ff9f8d7368fa309d4dbea3ea4bbd2feccf94a92cc8a20a226338a8e2126cd16f70eaf15b4fc9be2c3fa19def14e071956a605e9d1ac4162010e23fcb6bd445b7c25afb722250c1acbc061ed964ba9de1326609ae012acdfb96942b2a102a2de99ab96327859a34a2b49a767dbdb62e0a1fb26af60fe44fd496a00106bb0bac77ac68b347645f2fb1ad789ea9bd76fb9b2324f25ae06f97e65246f142df717f662e73948317182c62ce87d79c73def0dba12e5242dfc038382812cfe00126da03c5e56cb15aeeceadc1e17a45753ab4dc0ec7bf6a75ca03143ed4a294f6f61bc3f478a457833e43084ecd7c985bf2f55a55f168aac0e030fc49e845e497101626e9d9a5d9e343f00010000000000000000000000000000000000000000000000000000000000000004c1759167c43f501c2000000000000000000000000000000000000000000000000000000000436f7265020000000000021358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd66b9590e1c41e0b226937bf9217d1d67fd4e91f574a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";

    // Real mainnet guardian set upgrade VAA #2 (guardian_set_index=2, 13 signatures).
    const REAL_VAA_2: &str = "01000000020d00ce45474d9e1b1e7790a2d210871e195db53a70ffd6f237cfe70e2686a32859ac43c84a332267a8ef66f59719cf91cc8df0101fd7c36aa1878d5139241660edc0010375cc906156ae530786661c0cd9aef444747bc3d8d5aa84cac6a6d2933d4e1a031cffa30383d4af8131e929d9f203f460b07309a647d6cd32ab1cc7724089392c000452305156cfc90343128f97e499311b5cae174f488ff22fbc09591991a0a73d8e6af3afb8a5968441d3ab8437836407481739e9850ad5c95e6acfcc871e951bc30105a7956eefc23e7c945a1966d5ddbe9e4be376c2f54e45e3d5da88c2f8692510c7429b1ea860ae94d929bd97e84923a18187e777aa3db419813a80deb84cc8d22b00061b2a4f3d2666608e0aa96737689e3ba5793810ff3a52ff28ad57d8efb20967735dc5537a2e43ef10f583d144c12a1606542c207f5b79af08c38656d3ac40713301086b62c8e130af3411b3c0d91b5b50dcb01ed5f293963f901fc36e7b0e50114dce203373b32eb45971cef8288e5d928d0ed51cd86e2a3006b0af6a65c396c009080009e93ab4d2c8228901a5f4525934000b2c26d1dc679a05e47fdf0ff3231d98fbc207103159ff4116df2832eea69b38275283434e6cd4a4af04d25fa7a82990b707010aa643f4cf615dfff06ffd65830f7f6cf6512dabc3690d5d9e210fdc712842dc2708b8b2c22e224c99280cd25e5e8bfb40e3d1c55b8c41774e287c1e2c352aecfc010b89c1e85faa20a30601964ccc6a79c0ae53cfd26fb10863db37783428cd91390a163346558239db3cd9d420cfe423a0df84c84399790e2e308011b4b63e6b8015010ca31dcb564ac81a053a268d8090e72097f94f366711d0c5d13815af1ec7d47e662e2d1bde22678113d15963da100b668ba26c0c325970d07114b83c5698f46097010dc9fda39c0d592d9ed92cd22b5425cc6b37430e236f02d0d1f8a2ef45a00bde26223c0a6eb363c8b25fd3bf57234a1d9364976cefb8360e755a267cbbb674b39501108db01e444ab1003dd8b6c96f8eb77958b40ba7a85fefecf32ad00b7a47c0ae7524216262495977e09c0989dd50f280c21453d3756843608eacd17f4fdfe47600001261025228ef5af837cb060bcd986fcfa84ccef75b3fa100468cfd24e7fadf99163938f3b841a33496c2706d0208faab088bd155b2e20fd74c625bb1cc8c43677a0163c53c409e0c5dfa000100000000000000000000000000000000000000000000000000000000000000046c5a054d7833d1e42000000000000000000000000000000000000000000000000000000000436f7265020000000000031358cc3ae5c097b213ce3c81979e1b9f9570746aa5ff6cb952589bde862c25ef4392132fb9d4a42157114de8460193bdf3a2fcf81f86a09765f4762fd1107a0086b32d7a0977926a205131d8731d39cbeb8c82b2fd82faed2711d59af0f2499d16e726f6b211b39756c042441be6d8650b69b54ebe715e234354ce5b4d348fb74b958e8966e2ec3dbd4958a7cd15e7caf07c4e3dc8e7c469f92c8cd88fb8005a2074a3bf913953d695260d88bc1aa25a4eee363ef0000ac0076727b35fbea2dac28fee5ccb0fea768eaf45ced136b9d9e24903464ae889f5c8a723fc14f93124b7c738843cbb89e864c862c38cddcccf95d2cc37a4dc036a8d232b48f62cdd4731412f4890da798f6896a3331f64b48c12d1d57fd9cbe7081171aa1be1d36cafe3867910f99c09e347899c19c38192b6e7387ccd768277c17dab1b7a5027c0b3cf178e21ad2e77ae06711549cfbb1f9c7a9d8096e85e1487f35515d02a92753504a8d75471b9f49edb6fbebc898f403e4773e95feb15e80c9a99c8348d";

    /// Wormhole governance emitter address: all zeros except 0x04 at the last byte.
    fn governance_emitter_address() -> [u8; 32] {
        let mut addr = [0u8; 32];
        addr[31] = 0x04;
        addr
    }

    /// "Core" module identifier padded to 32 bytes (28 zero bytes + "Core").
    fn core_module_bytes() -> [u8; 32] {
        let mut m = [0u8; 32];
        m[28] = b'C';
        m[29] = b'o';
        m[30] = b'r';
        m[31] = b'e';
        m
    }

    /// Helper to run common assertions on a real mainnet guardian set upgrade VAA.
    fn assert_guardian_set_upgrade_vaa(
        env: &Env,
        vaa: &Vaa,
        expected_guardian_set_index: u32,
        expected_num_signatures: u32,
        expected_sequence: u64,
        expected_new_guardian_set_index: u32,
    ) {
        // Header fields
        assert_eq!(vaa.guardian_set_index, expected_guardian_set_index);
        assert_eq!(vaa.signatures.len(), expected_num_signatures);

        // All mainnet upgrade VAAs are emitted on Solana (chain 1)
        assert_eq!(vaa.body.emitter_chain, 1);

        // Governance emitter address
        assert_eq!(
            vaa.body.emitter_address,
            BytesN::from_array(env, &governance_emitter_address())
        );

        // Sequence
        assert_eq!(vaa.body.sequence, expected_sequence);

        // Body bytes should be non-trivial (51 bytes minimum body + payload)
        assert!(vaa.body_bytes.len() > 51);

        // Payload starts with "Core" module (32 bytes)
        let core = core_module_bytes();
        for i in 0..32u32 {
            assert_eq!(
                vaa.body.payload.get(i).unwrap(),
                core[i as usize],
                "Core module mismatch at byte {i}"
            );
        }

        // Action byte = 2 (guardian set upgrade)
        assert_eq!(vaa.body.payload.get(32).unwrap(), 2);

        // Target chain = 0 (all chains)
        assert_eq!(vaa.body.payload.get(33).unwrap(), 0);
        assert_eq!(vaa.body.payload.get(34).unwrap(), 0);

        // New guardian set index (BE u32 at payload offset 35..39)
        let new_gsi = ((vaa.body.payload.get(35).unwrap() as u32) << 24)
            | ((vaa.body.payload.get(36).unwrap() as u32) << 16)
            | ((vaa.body.payload.get(37).unwrap() as u32) << 8)
            | (vaa.body.payload.get(38).unwrap() as u32);
        assert_eq!(new_gsi, expected_new_guardian_set_index);

        // Number of guardians in upgrade payload = 19
        assert_eq!(vaa.body.payload.get(39).unwrap(), 19);
    }

    #[test]
    fn test_parse_real_mainnet_vaa_0() {
        let env = Env::default();
        let raw = hex_decode(REAL_VAA_0);
        let vaa_bytes = vec_to_bytes(&env, &raw);

        let vaa = parse_vaa(&env, &vaa_bytes).unwrap();

        assert_guardian_set_upgrade_vaa(
            &env,
            &vaa,
            0, // guardian_set_index
            1, // num_signatures (first VAA only has 1 signer)
            1337, // sequence
            1, // new guardian set index
        );

        // VAA[0] specific: timestamp and consistency_level
        assert_eq!(vaa.body.timestamp, 1628094930);
        assert_eq!(vaa.body.consistency_level, 0);
    }

    #[test]
    fn test_parse_real_mainnet_vaa_1() {
        let env = Env::default();
        let raw = hex_decode(REAL_VAA_1);
        let vaa_bytes = vec_to_bytes(&env, &raw);

        let vaa = parse_vaa(&env, &vaa_bytes).unwrap();

        assert_guardian_set_upgrade_vaa(
            &env,
            &vaa,
            1, // guardian_set_index
            13, // num_signatures (2/3+1 of 19)
            13940208096455381020, // sequence
            2, // new guardian set index
        );

        assert_eq!(vaa.body.timestamp, 1651416474);
        assert_eq!(vaa.body.consistency_level, 32);
    }

    #[test]
    fn test_parse_real_mainnet_vaa_2() {
        let env = Env::default();
        let raw = hex_decode(REAL_VAA_2);
        let vaa_bytes = vec_to_bytes(&env, &raw);

        let vaa = parse_vaa(&env, &vaa_bytes).unwrap();

        assert_guardian_set_upgrade_vaa(
            &env,
            &vaa,
            2, // guardian_set_index
            13, // num_signatures
            7807558734287458788, // sequence
            3, // new guardian set index
        );

        assert_eq!(vaa.body.timestamp, 1673870400);
        assert_eq!(vaa.body.consistency_level, 32);
    }
}
