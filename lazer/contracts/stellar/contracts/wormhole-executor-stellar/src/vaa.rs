use soroban_sdk::{contracttype, Bytes, BytesN, Env, Vec};

use crate::error::ContractError;

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
}
