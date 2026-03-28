use soroban_sdk::Bytes;

use crate::error::ContractError;

/// PTGM magic: "PTGM" = 0x5054474d
const PTGM_MAGIC: [u8; 4] = [0x50, 0x54, 0x47, 0x4d];

/// Module 3 = Lazer.
const LAZER_MODULE: u8 = 3;

/// Governance action: upgrade the target contract.
pub const ACTION_UPGRADE: u8 = 0;

/// Governance action: update a trusted signer on the target contract.
pub const ACTION_UPDATE_TRUSTED_SIGNER: u8 = 1;

/// PTGM header size: 4 (magic) + 1 (module) + 1 (action) + 2 (chain_id) = 8 bytes.
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
    pub pubkey: [u8; 33],
    pub expires_at: u64,
}

/// Parsed upgrade payload.
#[derive(Clone, Debug, PartialEq)]
pub struct UpgradePayload {
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

    match action {
        ACTION_UPDATE_TRUSTED_SIGNER => {
            // 33 (pubkey) + 8 (expires_at) = 41 bytes after header.
            if len < HEADER_SIZE + 41 {
                return Err(ContractError::TruncatedData);
            }

            let mut pubkey = [0u8; 33];
            for i in 0..33 {
                pubkey[i] = payload.get((HEADER_SIZE + i) as u32).unwrap();
            }

            let exp_offset = HEADER_SIZE + 33;
            let expires_at = ((payload.get(exp_offset as u32).unwrap() as u64) << 56)
                | ((payload.get((exp_offset + 1) as u32).unwrap() as u64) << 48)
                | ((payload.get((exp_offset + 2) as u32).unwrap() as u64) << 40)
                | ((payload.get((exp_offset + 3) as u32).unwrap() as u64) << 32)
                | ((payload.get((exp_offset + 4) as u32).unwrap() as u64) << 24)
                | ((payload.get((exp_offset + 5) as u32).unwrap() as u64) << 16)
                | ((payload.get((exp_offset + 6) as u32).unwrap() as u64) << 8)
                | (payload.get((exp_offset + 7) as u32).unwrap() as u64);

            Ok(GovernanceAction::UpdateTrustedSigner(
                UpdateTrustedSignerPayload { pubkey, expires_at },
            ))
        }
        ACTION_UPGRADE => {
            // 8 (version) + 32 (wasm_digest) = 40 bytes after header.
            if len < HEADER_SIZE + 40 {
                return Err(ContractError::TruncatedData);
            }

            let ver_offset = HEADER_SIZE;
            let version = ((payload.get(ver_offset as u32).unwrap() as u64) << 56)
                | ((payload.get((ver_offset + 1) as u32).unwrap() as u64) << 48)
                | ((payload.get((ver_offset + 2) as u32).unwrap() as u64) << 40)
                | ((payload.get((ver_offset + 3) as u32).unwrap() as u64) << 32)
                | ((payload.get((ver_offset + 4) as u32).unwrap() as u64) << 24)
                | ((payload.get((ver_offset + 5) as u32).unwrap() as u64) << 16)
                | ((payload.get((ver_offset + 6) as u32).unwrap() as u64) << 8)
                | (payload.get((ver_offset + 7) as u32).unwrap() as u64);

            let digest_offset = HEADER_SIZE + 8;
            let mut wasm_digest = [0u8; 32];
            for i in 0..32 {
                wasm_digest[i] = payload.get((digest_offset + i) as u32).unwrap();
            }

            Ok(GovernanceAction::Upgrade(UpgradePayload {
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
    use soroban_sdk::Env;

    const TEST_CHAIN_ID: u32 = 30;

    fn build_ptgm_header(module: u8, action: u8, chain_id: u16) -> alloc::vec::Vec<u8> {
        let mut data = alloc::vec::Vec::new();
        data.extend_from_slice(&PTGM_MAGIC);
        data.push(module);
        data.push(action);
        data.extend_from_slice(&chain_id.to_be_bytes());
        data
    }

    fn build_update_trusted_signer_ptgm(
        chain_id: u16,
        pubkey: &[u8; 33],
        expires_at: u64,
    ) -> alloc::vec::Vec<u8> {
        let mut data = build_ptgm_header(LAZER_MODULE, ACTION_UPDATE_TRUSTED_SIGNER, chain_id);
        data.extend_from_slice(pubkey);
        data.extend_from_slice(&expires_at.to_be_bytes());
        data
    }

    fn build_upgrade_ptgm(
        chain_id: u16,
        version: u64,
        wasm_digest: &[u8; 32],
    ) -> alloc::vec::Vec<u8> {
        let mut data = build_ptgm_header(LAZER_MODULE, ACTION_UPGRADE, chain_id);
        data.extend_from_slice(&version.to_be_bytes());
        data.extend_from_slice(wasm_digest);
        data
    }

    #[test]
    fn test_parse_update_trusted_signer() {
        let env = Env::default();
        let pubkey = [0xAA; 33];
        let expires_at = 1700000000u64;

        let raw = build_update_trusted_signer_ptgm(TEST_CHAIN_ID as u16, &pubkey, expires_at);
        let payload = Bytes::from_slice(&env, &raw);

        let result = parse_ptgm(&payload, TEST_CHAIN_ID).unwrap();
        match result {
            GovernanceAction::UpdateTrustedSigner(p) => {
                assert_eq!(p.pubkey, pubkey);
                assert_eq!(p.expires_at, expires_at);
            }
            _ => panic!("expected UpdateTrustedSigner"),
        }
    }

    #[test]
    fn test_parse_upgrade() {
        let env = Env::default();
        let version = 42u64;
        let wasm_digest = [0xBB; 32];

        let raw = build_upgrade_ptgm(TEST_CHAIN_ID as u16, version, &wasm_digest);
        let payload = Bytes::from_slice(&env, &raw);

        let result = parse_ptgm(&payload, TEST_CHAIN_ID).unwrap();
        match result {
            GovernanceAction::Upgrade(p) => {
                assert_eq!(p.version, version);
                assert_eq!(p.wasm_digest, wasm_digest);
            }
            _ => panic!("expected Upgrade"),
        }
    }

    #[test]
    fn test_invalid_magic() {
        let env = Env::default();
        let mut raw = build_update_trusted_signer_ptgm(TEST_CHAIN_ID as u16, &[0; 33], 0);
        raw[0] = 0xFF; // corrupt magic
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID).err(),
            Some(ContractError::InvalidPtgmMagic)
        );
    }

    #[test]
    fn test_invalid_module() {
        let env = Env::default();
        let mut raw = build_ptgm_header(99, ACTION_UPDATE_TRUSTED_SIGNER, TEST_CHAIN_ID as u16);
        // Add enough payload for update_trusted_signer.
        raw.extend_from_slice(&[0u8; 41]);
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID).err(),
            Some(ContractError::InvalidPtgmModule)
        );
    }

    #[test]
    fn test_invalid_target_chain() {
        let env = Env::default();
        let raw = build_update_trusted_signer_ptgm(99, &[0; 33], 0); // chain 99 != 30
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID).err(),
            Some(ContractError::InvalidTargetChain)
        );
    }

    #[test]
    fn test_invalid_action() {
        let env = Env::default();
        let mut raw = build_ptgm_header(LAZER_MODULE, 99, TEST_CHAIN_ID as u16);
        raw.extend_from_slice(&[0u8; 41]);
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID).err(),
            Some(ContractError::InvalidGovernanceAction)
        );
    }

    #[test]
    fn test_truncated_header() {
        let env = Env::default();
        let payload = Bytes::from_slice(&env, &[0x50, 0x54, 0x47]); // only 3 bytes
        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID).err(),
            Some(ContractError::TruncatedData)
        );
    }

    #[test]
    fn test_truncated_update_trusted_signer_payload() {
        let env = Env::default();
        let mut raw = build_ptgm_header(LAZER_MODULE, ACTION_UPDATE_TRUSTED_SIGNER, TEST_CHAIN_ID as u16);
        raw.extend_from_slice(&[0u8; 20]); // not enough for 33 + 8 = 41 bytes
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID).err(),
            Some(ContractError::TruncatedData)
        );
    }

    #[test]
    fn test_truncated_upgrade_payload() {
        let env = Env::default();
        let mut raw = build_ptgm_header(LAZER_MODULE, ACTION_UPGRADE, TEST_CHAIN_ID as u16);
        raw.extend_from_slice(&[0u8; 10]); // not enough for 8 + 32 = 40 bytes
        let payload = Bytes::from_slice(&env, &raw);

        assert_eq!(
            parse_ptgm(&payload, TEST_CHAIN_ID).err(),
            Some(ContractError::TruncatedData)
        );
    }

    #[test]
    fn test_parse_max_expires_at() {
        let env = Env::default();
        let raw = build_update_trusted_signer_ptgm(TEST_CHAIN_ID as u16, &[0xFF; 33], u64::MAX);
        let payload = Bytes::from_slice(&env, &raw);

        let result = parse_ptgm(&payload, TEST_CHAIN_ID).unwrap();
        match result {
            GovernanceAction::UpdateTrustedSigner(p) => {
                assert_eq!(p.expires_at, u64::MAX);
                assert_eq!(p.pubkey, [0xFF; 33]);
            }
            _ => panic!("expected UpdateTrustedSigner"),
        }
    }

    #[test]
    fn test_parse_max_version() {
        let env = Env::default();
        let raw = build_upgrade_ptgm(TEST_CHAIN_ID as u16, u64::MAX, &[0xFF; 32]);
        let payload = Bytes::from_slice(&env, &raw);

        let result = parse_ptgm(&payload, TEST_CHAIN_ID).unwrap();
        match result {
            GovernanceAction::Upgrade(p) => {
                assert_eq!(p.version, u64::MAX);
                assert_eq!(p.wasm_digest, [0xFF; 32]);
            }
            _ => panic!("expected Upgrade"),
        }
    }
}
