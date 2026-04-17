use soroban_sdk::{Address, Bytes};

use crate::error::ContractError;

/// PTGM magic: "PTGM" = 0x5054474d
const PTGM_MAGIC: [u8; 4] = [0x50, 0x54, 0x47, 0x4d];

/// Module 3 = Lazer.
const LAZER_MODULE: u8 = 3;

/// Governance action: upgrade the target contract.
pub const ACTION_UPGRADE: u8 = 0;

/// Governance action: update a trusted signer on the target contract.
pub const ACTION_UPDATE_TRUSTED_SIGNER: u8 = 1;

/// PTGM fixed header size: 4 (magic) + 1 (module) + 1 (action) + 2 (chain_id) = 8 bytes.
const HEADER_SIZE: usize = 8;

/// Parsed PTGM header.
#[derive(Clone, Debug, PartialEq)]
pub struct PtgmHeader {
    pub action: u8,
    pub target_chain_id: u16,
}

/// Parsed update_trusted_signer payload.
#[derive(Clone, Debug, PartialEq)]
pub struct UpdateTrustedSignerPayload {
    pub target_contract: Address,
    pub pubkey: [u8; 33],
    pub expires_at: u64,
}

/// Parsed upgrade payload.
#[derive(Clone, Debug, PartialEq)]
pub struct UpgradePayload {
    pub target_contract: Address,
    pub version: u64,
    pub wasm_digest: [u8; 32],
}

/// Parsed governance action from a PTGM.
#[derive(Clone, Debug, PartialEq)]
pub enum GovernanceAction {
    Upgrade(UpgradePayload),
    UpdateTrustedSigner(UpdateTrustedSignerPayload),
}

/// Parse a PTGM from a VAA payload.
///
/// Format:
/// - [4 bytes] magic "PTGM"
/// - [1 byte]  module (3 = Lazer)
/// - [1 byte]  action (0 = upgrade, 1 = update_trusted_signer)
/// - [2 bytes] target_chain_id (BE u16)
/// - action-specific payload
pub fn parse_ptgm(
    payload: &Bytes,
    our_chain_id: u32,
    expected_executor_contract: &Address,
) -> Result<GovernanceAction, ContractError> {
    let len = payload.len() as usize;

    if len < HEADER_SIZE {
        return Err(ContractError::TruncatedData);
    }

    // Verify magic.
    for i in 0..4 {
        if payload.get(i as u32).unwrap() != PTGM_MAGIC[i] {
            return Err(ContractError::InvalidPtgmMagic);
        }
    }

    // Verify module.
    let module = payload.get(4).unwrap();
    if module != LAZER_MODULE {
        return Err(ContractError::InvalidPtgmModule);
    }

    // Action.
    let action = payload.get(5).unwrap();

    // Target chain ID (BE u16).
    let target_chain_id =
        ((payload.get(6).unwrap() as u16) << 8) | (payload.get(7).unwrap() as u16);

    // Validate target chain: must match our chain (no wildcard 0 for PTGM).
    if target_chain_id as u32 != our_chain_id {
        return Err(ContractError::InvalidTargetChain);
    }

    // Routing metadata encoded in the PTGM payload:
    // - [1 byte]  executor contract address strkey length
    // - [N bytes] executor contract address strkey
    // - [1 byte]  target contract address strkey length
    // - [M bytes] target contract address strkey
    // (Note: stellar addresses are variable length, hence the length fields)
    let mut offset = HEADER_SIZE;
    if len < offset + 2 {
        return Err(ContractError::TruncatedData);
    }

    let executor_len = payload.get(offset as u32).unwrap() as usize;
    offset += 1;
    if executor_len == 0 || len < offset + executor_len {
        return Err(ContractError::TruncatedData);
    }
    let executor_contract = Address::from_string_bytes(
        &payload.slice(offset as u32..(offset + executor_len) as u32),
    );
    offset += executor_len;
    if &executor_contract != expected_executor_contract {
        return Err(ContractError::InvalidExecutorAddress);
    }

    if len < offset + 1 {
        return Err(ContractError::TruncatedData);
    }
    let target_len = payload.get(offset as u32).unwrap() as usize;
    offset += 1;
    if target_len == 0 || len < offset + target_len {
        return Err(ContractError::TruncatedData);
    }
    let target_contract =
        Address::from_string_bytes(&payload.slice(offset as u32..(offset + target_len) as u32));
    offset += target_len;

    match action {
        ACTION_UPDATE_TRUSTED_SIGNER => {
            // 33 (pubkey) + 8 (expires_at) = 41 bytes after header.
            if len < offset + 41 {
                return Err(ContractError::TruncatedData);
            }

            let mut pubkey = [0u8; 33];
            for i in 0..33 {
                pubkey[i] = payload.get((offset + i) as u32).unwrap();
            }

            let exp_offset = offset + 33;
            let expires_at = ((payload.get(exp_offset as u32).unwrap() as u64) << 56)
                | ((payload.get((exp_offset + 1) as u32).unwrap() as u64) << 48)
                | ((payload.get((exp_offset + 2) as u32).unwrap() as u64) << 40)
                | ((payload.get((exp_offset + 3) as u32).unwrap() as u64) << 32)
                | ((payload.get((exp_offset + 4) as u32).unwrap() as u64) << 24)
                | ((payload.get((exp_offset + 5) as u32).unwrap() as u64) << 16)
                | ((payload.get((exp_offset + 6) as u32).unwrap() as u64) << 8)
                | (payload.get((exp_offset + 7) as u32).unwrap() as u64);

            Ok(GovernanceAction::UpdateTrustedSigner(
                UpdateTrustedSignerPayload {
                    target_contract,
                    pubkey,
                    expires_at,
                },
            ))
        }
        ACTION_UPGRADE => {
            // 8 (version) + 32 (wasm_digest) = 40 bytes after header.
            if len < offset + 40 {
                return Err(ContractError::TruncatedData);
            }

            let ver_offset = offset;
            let version = ((payload.get(ver_offset as u32).unwrap() as u64) << 56)
                | ((payload.get((ver_offset + 1) as u32).unwrap() as u64) << 48)
                | ((payload.get((ver_offset + 2) as u32).unwrap() as u64) << 40)
                | ((payload.get((ver_offset + 3) as u32).unwrap() as u64) << 32)
                | ((payload.get((ver_offset + 4) as u32).unwrap() as u64) << 24)
                | ((payload.get((ver_offset + 5) as u32).unwrap() as u64) << 16)
                | ((payload.get((ver_offset + 6) as u32).unwrap() as u64) << 8)
                | (payload.get((ver_offset + 7) as u32).unwrap() as u64);

            let digest_offset = offset + 8;
            let mut wasm_digest = [0u8; 32];
            for i in 0..32 {
                wasm_digest[i] = payload.get((digest_offset + i) as u32).unwrap();
            }

            Ok(GovernanceAction::Upgrade(UpgradePayload {
                target_contract,
                version,
                wasm_digest,
            }))
        }
        _ => Err(ContractError::InvalidGovernanceAction),
    }
}

#[cfg(test)]
mod tests {
    extern crate alloc;

    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    const TEST_CHAIN_ID: u32 = 30;

    fn address_to_payload_bytes(address: &Address) -> alloc::vec::Vec<u8> {
        let strkey = address.to_string();
        let mut out = alloc::vec![0u8; strkey.len() as usize];
        strkey.copy_into_slice(&mut out);
        out
    }

    fn build_ptgm_header(
        module: u8,
        action: u8,
        chain_id: u16,
        executor_contract: &Address,
        target_contract: &Address,
    ) -> alloc::vec::Vec<u8> {
        let mut data = alloc::vec::Vec::new();
        data.extend_from_slice(&PTGM_MAGIC);
        data.push(module);
        data.push(action);
        data.extend_from_slice(&chain_id.to_be_bytes());
        let executor = address_to_payload_bytes(executor_contract);
        data.push(executor.len() as u8);
        data.extend_from_slice(&executor);
        let target = address_to_payload_bytes(target_contract);
        data.push(target.len() as u8);
        data.extend_from_slice(&target);
        data
    }

    fn build_update_trusted_signer_ptgm(
        chain_id: u16,
        executor_contract: &Address,
        target_contract: &Address,
        pubkey: &[u8; 33],
        expires_at: u64,
    ) -> alloc::vec::Vec<u8> {
        let mut data = build_ptgm_header(
            LAZER_MODULE,
            ACTION_UPDATE_TRUSTED_SIGNER,
            chain_id,
            executor_contract,
            target_contract,
        );
        data.extend_from_slice(pubkey);
        data.extend_from_slice(&expires_at.to_be_bytes());
        data
    }

    fn build_upgrade_ptgm(
        chain_id: u16,
        executor_contract: &Address,
        target_contract: &Address,
        version: u64,
        wasm_digest: &[u8; 32],
    ) -> alloc::vec::Vec<u8> {
        let mut data = build_ptgm_header(
            LAZER_MODULE,
            ACTION_UPGRADE,
            chain_id,
            executor_contract,
            target_contract,
        );
        data.extend_from_slice(&version.to_be_bytes());
        data.extend_from_slice(wasm_digest);
        data
    }

    #[test]
    fn test_parse_update_trusted_signer() {
        let env = Env::default();
        let executor = Address::generate(&env);
        let target = Address::generate(&env);
        let pubkey = [0xAA; 33];
        let expires_at = 1700000000u64;

        let raw = build_update_trusted_signer_ptgm(
            TEST_CHAIN_ID as u16,
            &executor,
            &target,
            &pubkey,
            expires_at,
        );
        let payload = Bytes::from_slice(&env, &raw);

        let result = parse_ptgm(&payload, TEST_CHAIN_ID, &executor).unwrap();
        match result {
            GovernanceAction::UpdateTrustedSigner(p) => {
                assert_eq!(p.target_contract, target);
                assert_eq!(p.pubkey, pubkey);
                assert_eq!(p.expires_at, expires_at);
            }
            _ => panic!("expected UpdateTrustedSigner"),
        }
    }

    #[test]
    fn test_parse_upgrade() {
        let env = Env::default();
        let executor = Address::generate(&env);
        let target = Address::generate(&env);
        let version = 42u64;
        let wasm_digest = [0xBB; 32];

        let raw = build_upgrade_ptgm(
            TEST_CHAIN_ID as u16,
            &executor,
            &target,
            version,
            &wasm_digest,
        );
        let payload = Bytes::from_slice(&env, &raw);

        let result = parse_ptgm(&payload, TEST_CHAIN_ID, &executor).unwrap();
        match result {
            GovernanceAction::Upgrade(p) => {
                assert_eq!(p.target_contract, target);
                assert_eq!(p.version, version);
                assert_eq!(p.wasm_digest, wasm_digest);
            }
            _ => panic!("expected Upgrade"),
        }
    }

    #[test]
    fn test_invalid_magic() {
        let env = Env::default();
        let executor = Address::generate(&env);
        let target = Address::generate(&env);
        let mut raw = build_update_trusted_signer_ptgm(
            TEST_CHAIN_ID as u16,
            &executor,
            &target,
            &[0; 33],
            0,
        );
        raw[0] = 0xFF; // corrupt magic
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID, &executor).err(),
            Some(ContractError::InvalidPtgmMagic)
        );
    }

    #[test]
    fn test_invalid_module() {
        let env = Env::default();
        let executor = Address::generate(&env);
        let target = Address::generate(&env);
        let mut raw = build_ptgm_header(
            99,
            ACTION_UPDATE_TRUSTED_SIGNER,
            TEST_CHAIN_ID as u16,
            &executor,
            &target,
        );
        // Add enough payload for update_trusted_signer.
        raw.extend_from_slice(&[0u8; 41]);
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID, &executor).err(),
            Some(ContractError::InvalidPtgmModule)
        );
    }

    #[test]
    fn test_invalid_target_chain() {
        let env = Env::default();
        let executor = Address::generate(&env);
        let target = Address::generate(&env);
        let raw = build_update_trusted_signer_ptgm(99, &executor, &target, &[0; 33], 0); // chain 99 != 30
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID, &executor).err(),
            Some(ContractError::InvalidTargetChain)
        );
    }

    #[test]
    fn test_invalid_action() {
        let env = Env::default();
        let executor = Address::generate(&env);
        let target = Address::generate(&env);
        let mut raw =
            build_ptgm_header(LAZER_MODULE, 99, TEST_CHAIN_ID as u16, &executor, &target);
        raw.extend_from_slice(&[0u8; 41]);
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID, &executor).err(),
            Some(ContractError::InvalidGovernanceAction)
        );
    }

    #[test]
    fn test_truncated_header() {
        let env = Env::default();
        let payload = Bytes::from_slice(&env, &[0x50, 0x54, 0x47]); // only 3 bytes
        let expected_executor = Address::generate(&env);
        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID, &expected_executor).err(),
            Some(ContractError::TruncatedData)
        );
    }

    #[test]
    fn test_truncated_update_trusted_signer_payload() {
        let env = Env::default();
        let executor = Address::generate(&env);
        let target = Address::generate(&env);
        let mut raw = build_ptgm_header(
            LAZER_MODULE,
            ACTION_UPDATE_TRUSTED_SIGNER,
            TEST_CHAIN_ID as u16,
            &executor,
            &target,
        );
        raw.extend_from_slice(&[0u8; 20]); // not enough for 33 + 8 = 41 bytes
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID, &executor).err(),
            Some(ContractError::TruncatedData)
        );
    }

    #[test]
    fn test_truncated_upgrade_payload() {
        let env = Env::default();
        let executor = Address::generate(&env);
        let target = Address::generate(&env);
        let mut raw = build_ptgm_header(
            LAZER_MODULE,
            ACTION_UPGRADE,
            TEST_CHAIN_ID as u16,
            &executor,
            &target,
        );
        raw.extend_from_slice(&[0u8; 10]); // not enough for 8 + 32 = 40 bytes
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID, &executor).err(),
            Some(ContractError::TruncatedData)
        );
    }

    #[test]
    fn test_parse_max_expires_at() {
        let env = Env::default();
        let executor = Address::generate(&env);
        let target = Address::generate(&env);
        let raw = build_update_trusted_signer_ptgm(
            TEST_CHAIN_ID as u16,
            &executor,
            &target,
            &[0xFF; 33],
            u64::MAX,
        );
        let payload = Bytes::from_slice(&env, &raw);

        let result = parse_ptgm(&payload, TEST_CHAIN_ID, &executor).unwrap();
        match result {
            GovernanceAction::UpdateTrustedSigner(p) => {
                assert_eq!(p.target_contract, target);
                assert_eq!(p.expires_at, u64::MAX);
                assert_eq!(p.pubkey, [0xFF; 33]);
            }
            _ => panic!("expected UpdateTrustedSigner"),
        }
    }

    #[test]
    fn test_parse_max_version() {
        let env = Env::default();
        let executor = Address::generate(&env);
        let target = Address::generate(&env);
        let raw = build_upgrade_ptgm(
            TEST_CHAIN_ID as u16,
            &executor,
            &target,
            u64::MAX,
            &[0xFF; 32],
        );
        let payload = Bytes::from_slice(&env, &raw);

        let result = parse_ptgm(&payload, TEST_CHAIN_ID, &executor).unwrap();
        match result {
            GovernanceAction::Upgrade(p) => {
                assert_eq!(p.target_contract, target);
                assert_eq!(p.version, u64::MAX);
                assert_eq!(p.wasm_digest, [0xFF; 32]);
            }
            _ => panic!("expected Upgrade"),
        }
    }

    #[test]
    fn test_invalid_executor_address() {
        let env = Env::default();
        let executor = Address::generate(&env);
        let wrong_executor = Address::generate(&env);
        let target = Address::generate(&env);
        let raw = build_update_trusted_signer_ptgm(
            TEST_CHAIN_ID as u16,
            &executor,
            &target,
            &[0xAA; 33],
            1000,
        );
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID, &wrong_executor).err(),
            Some(ContractError::InvalidExecutorAddress)
        );
    }
}
