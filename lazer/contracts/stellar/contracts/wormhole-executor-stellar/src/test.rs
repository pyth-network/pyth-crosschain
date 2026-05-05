extern crate alloc;
extern crate std;

use alloc::vec;
use k256::ecdsa::SigningKey;
use soroban_sdk::{Address, Bytes, BytesN, Env, Vec};
use tiny_keccak::{Hasher, Keccak};

use crate::error::ContractError;
use crate::guardian;
use crate::vaa::{parse_vaa, verify_vaa};
use crate::WormholeExecutor;
use crate::WormholeExecutorClient;

// Tests for the WormholeExecutor contract.
// NOTE: See the integration-tests module for tests of execute_governance_action,
// as these require both contracts to be deployed.

// ──────────────────────────────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────────────────────────────

/// Well-known test private keys (32 bytes each).
fn test_secret(index: u8) -> [u8; 32] {
    let mut secret = [0u8; 32];
    secret[31] = index + 1; // simple deterministic secrets: 0x01, 0x02, ...
    secret
}

/// Derive the Ethereum address from a private key using off-chain k256.
fn eth_address_from_secret(secret: &[u8; 32]) -> [u8; 20] {
    let signing_key = SigningKey::from_bytes(secret.into()).expect("valid key");
    let verifying_key = signing_key.verifying_key();
    let uncompressed = verifying_key.to_encoded_point(false);
    let pubkey_bytes = &uncompressed.as_bytes()[1..]; // skip 0x04 prefix

    let mut hasher = Keccak::v256();
    let mut hash = [0u8; 32];
    hasher.update(pubkey_bytes);
    hasher.finalize(&mut hash);

    let mut addr = [0u8; 20];
    addr.copy_from_slice(&hash[12..32]);
    addr
}

/// Compute keccak256 off-chain.
fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak::v256();
    let mut out = [0u8; 32];
    hasher.update(data);
    hasher.finalize(&mut out);
    out
}

/// Sign a message hash (already keccak256'd) with a private key,
/// returning (r||s as [u8; 64], recovery_id as u32).
fn sign_hash(secret: &[u8; 32], hash: &[u8; 32]) -> ([u8; 64], u32) {
    let signing_key = SigningKey::from_bytes(secret.into()).expect("valid key");
    let (signature, recovery_id) = signing_key
        .sign_prehash_recoverable(hash)
        .expect("signing failed");
    let sig_bytes: [u8; 64] = signature.to_bytes().into();
    (sig_bytes, recovery_id.to_byte() as u32)
}

/// Build a raw VAA body (no header/signatures).
fn build_body(
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

/// Build a complete VAA with real signatures.
///
/// `signers` is a list of (guardian_index, secret_key) tuples.
fn build_signed_vaa(
    guardian_set_index: u32,
    signers: &[(u8, [u8; 32])],
    body: &[u8],
) -> alloc::vec::Vec<u8> {
    // Wormhole double-hash: keccak256(keccak256(body))
    let body_hash = keccak256(body);
    let double_hash = keccak256(&body_hash);

    let mut vaa = alloc::vec::Vec::new();
    vaa.push(1u8); // version
    vaa.extend_from_slice(&guardian_set_index.to_be_bytes());
    vaa.push(signers.len() as u8);

    for (guardian_index, secret) in signers {
        let (sig, recovery_id) = sign_hash(secret, &double_hash);
        vaa.push(*guardian_index);
        vaa.extend_from_slice(&sig);
        vaa.push(recovery_id as u8);
    }

    vaa.extend_from_slice(body);
    vaa
}

/// Deploy the contract with constructor args and a test guardian set.
/// Returns (client, contract_address, secrets).
fn setup_contract(
    env: &Env,
    num_guardians: u8,
    guardian_set_index: u32,
) -> (WormholeExecutorClient, Address, alloc::vec::Vec<[u8; 32]>) {
    let mut secrets = alloc::vec::Vec::new();
    let mut guardian_addrs: Vec<BytesN<20>> = Vec::new(env);

    for i in 0..num_guardians {
        let secret = test_secret(i);
        let addr = eth_address_from_secret(&secret);
        secrets.push(secret);
        guardian_addrs.push_back(BytesN::from_array(env, &addr));
    }

    let owner_emitter_address = BytesN::from_array(env, &[0u8; 32]);

    let contract_id = env.register(
        WormholeExecutor,
        (
            30u32, // chain_id (arbitrary for tests)
            1u32,  // owner_emitter_chain
            owner_emitter_address,
            guardian_addrs,
            guardian_set_index,
        ),
    );
    let client = WormholeExecutorClient::new(env, &contract_id);

    (client, contract_id, secrets)
}

// ──────────────────────────────────────────────────────────────────────
// Tests: quorum calculation
// ──────────────────────────────────────────────────────────────────────

#[test]
fn test_quorum_calculation() {
    assert_eq!(guardian::quorum(1), 1);
    assert_eq!(guardian::quorum(2), 2);
    assert_eq!(guardian::quorum(3), 3);
    assert_eq!(guardian::quorum(4), 3);
    assert_eq!(guardian::quorum(7), 5);
    assert_eq!(guardian::quorum(13), 9);
    assert_eq!(guardian::quorum(19), 13);
}

// ──────────────────────────────────────────────────────────────────────
// Tests: eth address derivation
// ──────────────────────────────────────────────────────────────────────

#[test]
fn test_eth_address_derivation() {
    let env = Env::default();
    let secret = test_secret(0);
    let expected_addr = eth_address_from_secret(&secret);

    let signing_key = SigningKey::from_bytes((&secret).into()).expect("valid key");
    let verifying_key = signing_key.verifying_key();
    let uncompressed = verifying_key.to_encoded_point(false);
    let uncompressed_bytes: [u8; 65] = uncompressed.as_bytes().try_into().expect("65 bytes");

    let soroban_uncompressed = BytesN::from_array(&env, &uncompressed_bytes);
    let derived_addr = guardian::eth_address_from_pubkey(&env, &soroban_uncompressed);

    assert_eq!(derived_addr, BytesN::from_array(&env, &expected_addr));
}

// ──────────────────────────────────────────────────────────────────────
// Tests: constructor deployment
// ──────────────────────────────────────────────────────────────────────

#[test]
fn test_constructor_deployment_success() {
    let env = Env::default();
    let (_, contract_id, _) = setup_contract(&env, 3, 0);

    // Access storage in contract context.
    env.as_contract(&contract_id, || {
        let gs = guardian::get_guardian_set(&env);
        assert!(gs.is_ok());
        let gs = gs.unwrap_or(Vec::new(&env));
        assert_eq!(gs.len(), 3);
        assert_eq!(guardian::get_guardian_set_index(&env), Ok(0));
        assert_eq!(guardian::get_chain_id(&env), Ok(30));
    });
}



// ──────────────────────────────────────────────────────────────────────
// Tests: VAA signature verification
// ──────────────────────────────────────────────────────────────────────

#[test]
fn test_verify_vaa_success_single_guardian() {
    let env = Env::default();
    let (_, contract_id, secrets) = setup_contract(&env, 1, 0);

    let body = build_body(1000, 42, 1, &[0xABu8; 32], 99, 32, &[0x01, 0x02]);
    let vaa_raw = build_signed_vaa(0, &[(0, secrets[0])], &body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    let vaa = parse_vaa(&env, &vaa_bytes).unwrap();
    env.as_contract(&contract_id, || {
        let result = verify_vaa(&env, &vaa);
        assert!(result.is_ok());
    });
}

#[test]
fn test_verify_vaa_success_quorum() {
    let env = Env::default();
    let (_, contract_id, secrets) = setup_contract(&env, 3, 0);

    let body = build_body(2000, 0, 1, &[0x01u8; 32], 500, 15, &[0xDE, 0xAD]);
    let signers: alloc::vec::Vec<(u8, [u8; 32])> = (0..3).map(|i| (i as u8, secrets[i as usize])).collect();
    let vaa_raw = build_signed_vaa(0, &signers, &body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    let vaa = parse_vaa(&env, &vaa_bytes).unwrap();
    env.as_contract(&contract_id, || {
        let result = verify_vaa(&env, &vaa);
        assert!(result.is_ok());
    });
}

#[test]
fn test_verify_vaa_quorum_with_19_guardians() {
    let env = Env::default();
    let (_, contract_id, secrets) = setup_contract(&env, 19, 4);

    // Quorum for 19 = 13. Sign with guardians 0..12 (13 signatures).
    let body = build_body(1700000000, 12345, 1, &[0x55u8; 32], 9999, 32, &[0xCA, 0xFE]);
    let signers: alloc::vec::Vec<(u8, [u8; 32])> = (0..13).map(|i| (i as u8, secrets[i as usize])).collect();
    let vaa_raw = build_signed_vaa(4, &signers, &body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    let vaa = parse_vaa(&env, &vaa_bytes).unwrap();
    env.as_contract(&contract_id, || {
        let result = verify_vaa(&env, &vaa);
        assert!(result.is_ok());
    });
}

#[test]
fn test_verify_vaa_no_quorum() {
    let env = Env::default();
    let (_, contract_id, secrets) = setup_contract(&env, 4, 0);

    // Quorum for 4 = 3. Only provide 2 signatures.
    let body = build_body(1000, 0, 1, &[0u8; 32], 1, 0, &[]);
    let signers = vec![(0u8, secrets[0]), (1u8, secrets[1])];
    let vaa_raw = build_signed_vaa(0, &signers, &body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    let vaa = parse_vaa(&env, &vaa_bytes).unwrap();
    env.as_contract(&contract_id, || {
        let result = verify_vaa(&env, &vaa);
        assert_eq!(result.err(), Some(ContractError::NoQuorum));
    });
}

#[test]
fn test_verify_vaa_wrong_guardian_set_index() {
    let env = Env::default();
    let (_, contract_id, secrets) = setup_contract(&env, 1, 0);

    let body = build_body(1000, 0, 1, &[0u8; 32], 1, 0, &[]);
    // Sign with guardian_set_index = 1, but stored is 0.
    let vaa_raw = build_signed_vaa(1, &[(0u8, secrets[0])], &body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    let vaa = parse_vaa(&env, &vaa_bytes).unwrap();
    env.as_contract(&contract_id, || {
        let result = verify_vaa(&env, &vaa);
        assert_eq!(result.err(), Some(ContractError::InvalidGuardianSetIndex));
    });
}

#[test]
fn test_verify_vaa_invalid_signature() {
    let env = Env::default();
    let (_, contract_id, _secrets) = setup_contract(&env, 1, 0);

    // Use a different secret to sign (not in guardian set).
    let wrong_secret = test_secret(99);
    let body = build_body(1000, 0, 1, &[0u8; 32], 1, 0, &[]);
    let vaa_raw = build_signed_vaa(0, &[(0u8, wrong_secret)], &body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    let vaa = parse_vaa(&env, &vaa_bytes).unwrap();
    env.as_contract(&contract_id, || {
        let result = verify_vaa(&env, &vaa);
        assert_eq!(result.err(), Some(ContractError::GuardianSignatureMismatch));
    });
}

#[test]
fn test_verify_vaa_duplicate_guardian_index() {
    let env = Env::default();
    let (_, contract_id, secrets) = setup_contract(&env, 3, 0);

    let body = build_body(1000, 0, 1, &[0u8; 32], 1, 0, &[]);
    let body_hash = keccak256(&body);
    let double_hash = keccak256(&body_hash);

    let (sig0, rec0) = sign_hash(&secrets[0], &double_hash);
    let (sig0b, rec0b) = sign_hash(&secrets[0], &double_hash);

    let mut vaa_raw = alloc::vec::Vec::new();
    vaa_raw.push(1u8); // version
    vaa_raw.extend_from_slice(&0u32.to_be_bytes());
    vaa_raw.push(3u8); // num_signatures = 3

    // guardian_index 0
    vaa_raw.push(0u8);
    vaa_raw.extend_from_slice(&sig0);
    vaa_raw.push(rec0 as u8);
    // guardian_index 0 again (duplicate - not ascending)
    vaa_raw.push(0u8);
    vaa_raw.extend_from_slice(&sig0b);
    vaa_raw.push(rec0b as u8);
    // guardian_index 1
    let (sig1, rec1) = sign_hash(&secrets[1], &double_hash);
    vaa_raw.push(1u8);
    vaa_raw.extend_from_slice(&sig1);
    vaa_raw.push(rec1 as u8);

    vaa_raw.extend_from_slice(&body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    let vaa = parse_vaa(&env, &vaa_bytes).unwrap();
    env.as_contract(&contract_id, || {
        let result = verify_vaa(&env, &vaa);
        assert_eq!(result.err(), Some(ContractError::DuplicateGuardianSignature));
    });
}

#[test]
fn test_verify_vaa_guardian_index_out_of_bounds() {
    let env = Env::default();
    let (_, contract_id, secrets) = setup_contract(&env, 1, 0);

    let body = build_body(1000, 0, 1, &[0u8; 32], 1, 0, &[]);
    let body_hash = keccak256(&body);
    let double_hash = keccak256(&body_hash);
    let (sig, rec) = sign_hash(&secrets[0], &double_hash);

    let mut vaa_raw = alloc::vec::Vec::new();
    vaa_raw.push(1u8);
    vaa_raw.extend_from_slice(&0u32.to_be_bytes());
    vaa_raw.push(1u8); // 1 signature
    vaa_raw.push(5u8); // guardian_index = 5 (out of bounds)
    vaa_raw.extend_from_slice(&sig);
    vaa_raw.push(rec as u8);
    vaa_raw.extend_from_slice(&body);

    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    let vaa = parse_vaa(&env, &vaa_bytes).unwrap();
    env.as_contract(&contract_id, || {
        let result = verify_vaa(&env, &vaa);
        assert_eq!(result.err(), Some(ContractError::InvalidGuardianIndex));
    });
}

// ──────────────────────────────────────────────────────────────────────
// Tests: guardian set upgrade
// ──────────────────────────────────────────────────────────────────────

/// Build a guardian set upgrade payload.
fn build_guardian_set_upgrade_payload(
    target_chain: u16,
    new_index: u32,
    new_guardians: &[[u8; 20]],
) -> alloc::vec::Vec<u8> {
    let mut payload = alloc::vec::Vec::new();

    // Module: "Core" right-aligned in 32 bytes.
    payload.extend_from_slice(b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00Core");
    // Action: 2 (guardian set upgrade).
    payload.push(2);
    // Target chain.
    payload.extend_from_slice(&target_chain.to_be_bytes());
    // New guardian set index.
    payload.extend_from_slice(&new_index.to_be_bytes());
    // Num guardians.
    payload.push(new_guardians.len() as u8);
    // Guardian addresses.
    for addr in new_guardians {
        payload.extend_from_slice(addr);
    }

    payload
}

#[test]
fn test_guardian_set_upgrade() {
    let env = Env::default();
    let (client, contract_id, secrets) = setup_contract(&env, 1, 0);

    let new_secret_0 = test_secret(10);
    let new_secret_1 = test_secret(11);
    let new_addr_0 = eth_address_from_secret(&new_secret_0);
    let new_addr_1 = eth_address_from_secret(&new_secret_1);

    let upgrade_payload = build_guardian_set_upgrade_payload(0, 1, &[new_addr_0, new_addr_1]);
    let body = build_body(1000, 0, 1, &[0u8; 32], 1, 0, &upgrade_payload);
    let vaa_raw = build_signed_vaa(0, &[(0u8, secrets[0])], &body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    client.update_guardian_set(&vaa_bytes);

    env.as_contract(&contract_id, || {
        let gs = guardian::get_guardian_set(&env);
        assert!(gs.is_ok());
        let gs = gs.unwrap_or(Vec::new(&env));
        assert_eq!(gs.len(), 2);
        assert_eq!(gs.get(0).unwrap(), BytesN::from_array(&env, &new_addr_0));
        assert_eq!(gs.get(1).unwrap(), BytesN::from_array(&env, &new_addr_1));
        assert_eq!(guardian::get_guardian_set_index(&env), Ok(1));
    });
}

#[test]
fn test_guardian_set_upgrade_wrong_index() {
    let env = Env::default();
    let (client, _, secrets) = setup_contract(&env, 1, 0);

    let new_addr = eth_address_from_secret(&test_secret(10));

    let upgrade_payload = build_guardian_set_upgrade_payload(0, 5, &[new_addr]);
    let body = build_body(1000, 0, 1, &[0u8; 32], 1, 0, &upgrade_payload);
    let vaa_raw = build_signed_vaa(0, &[(0u8, secrets[0])], &body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    let result = client.try_update_guardian_set(&vaa_bytes);
    assert!(result.is_err());
}

#[test]
fn test_guardian_set_upgrade_empty_set() {
    let env = Env::default();
    let (client, _, secrets) = setup_contract(&env, 1, 0);

    let upgrade_payload = build_guardian_set_upgrade_payload(0, 1, &[]);
    let body = build_body(1000, 0, 1, &[0u8; 32], 1, 0, &upgrade_payload);
    let vaa_raw = build_signed_vaa(0, &[(0u8, secrets[0])], &body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    let result = client.try_update_guardian_set(&vaa_bytes);
    assert!(result.is_err());
}

#[test]
fn test_guardian_set_upgrade_chain_specific() {
    let env = Env::default();
    let (client, contract_id, secrets) = setup_contract(&env, 1, 0);

    let new_addr = eth_address_from_secret(&test_secret(10));

    // target_chain = 30 (our chain) should work.
    let upgrade_payload = build_guardian_set_upgrade_payload(30, 1, &[new_addr]);
    let body = build_body(1000, 0, 1, &[0u8; 32], 1, 0, &upgrade_payload);
    let vaa_raw = build_signed_vaa(0, &[(0u8, secrets[0])], &body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    client.update_guardian_set(&vaa_bytes);
    env.as_contract(&contract_id, || {
        assert_eq!(guardian::get_guardian_set_index(&env), Ok(1));
    });
}

#[test]
fn test_guardian_set_upgrade_wrong_chain() {
    let env = Env::default();
    let (client, _, secrets) = setup_contract(&env, 1, 0);

    let new_addr = eth_address_from_secret(&test_secret(10));

    // target_chain = 5 (not our chain, and not 0).
    let upgrade_payload = build_guardian_set_upgrade_payload(5, 1, &[new_addr]);
    let body = build_body(1000, 0, 1, &[0u8; 32], 1, 0, &upgrade_payload);
    let vaa_raw = build_signed_vaa(0, &[(0u8, secrets[0])], &body);
    let vaa_bytes = Bytes::from_slice(&env, &vaa_raw);

    let result = client.try_update_guardian_set(&vaa_bytes);
    assert!(result.is_err());
}

#[test]
fn test_sequential_guardian_set_upgrades() {
    let env = Env::default();
    let (client, contract_id, secrets) = setup_contract(&env, 1, 0);

    // Upgrade 0 -> 1
    let new_secret = test_secret(10);
    let new_addr = eth_address_from_secret(&new_secret);
    let upgrade_payload = build_guardian_set_upgrade_payload(0, 1, &[new_addr]);
    let body = build_body(1000, 0, 1, &[0u8; 32], 1, 0, &upgrade_payload);
    let vaa_raw = build_signed_vaa(0, &[(0u8, secrets[0])], &body);
    client.update_guardian_set(&Bytes::from_slice(&env, &vaa_raw));
    env.as_contract(&contract_id, || {
        assert_eq!(guardian::get_guardian_set_index(&env), Ok(1));
    });

    // Upgrade 1 -> 2 with the new guardian set
    let new_secret_2 = test_secret(20);
    let new_addr_2 = eth_address_from_secret(&new_secret_2);
    let upgrade_payload_2 = build_guardian_set_upgrade_payload(0, 2, &[new_addr_2]);
    let body_2 = build_body(2000, 0, 1, &[0u8; 32], 2, 0, &upgrade_payload_2);
    let vaa_raw_2 = build_signed_vaa(1, &[(0u8, new_secret)], &body_2);
    client.update_guardian_set(&Bytes::from_slice(&env, &vaa_raw_2));
    env.as_contract(&contract_id, || {
        assert_eq!(guardian::get_guardian_set_index(&env), Ok(2));
        let gs = guardian::get_guardian_set(&env);
        assert!(gs.is_ok());
        let gs = gs.unwrap_or(Vec::new(&env));
        assert_eq!(gs.len(), 1);
    });
}
