use soroban_sdk::{contracttype, BytesN, Env, Vec};

use crate::error::ContractError;

/// TTL threshold: extend when TTL drops below this (~6 days in ledgers at ~5s/ledger).
const TTL_THRESHOLD: u32 = 100_000;
/// TTL extension target: extend to this value (~29 days in ledgers at ~5s/ledger).
const TTL_EXTEND_TO: u32 = 500_000;

/// Storage keys for the executor contract.
#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    /// Whether the contract has been initialized.
    Initialized,
    /// The current guardian set: Vec<BytesN<20>> (Ethereum addresses).
    GuardianSet,
    /// The current guardian set index (u32).
    GuardianSetIndex,
    /// The Wormhole chain ID for this chain (u16 stored as u32).
    ChainId,
    /// The authorized governance emitter chain ID (u16 stored as u32).
    OwnerEmitterChain,
    /// The authorized governance emitter address (32 bytes).
    OwnerEmitterAddress,
    /// The last executed governance sequence number (u64).
    LastExecutedSequence,
}

/// Store the initial contract configuration.
///
/// This must be called exactly once. It stores the guardian set, owner emitter
/// chain/address, and chain ID.
pub fn initialize(
    env: &Env,
    chain_id: u32,
    owner_emitter_chain: u32,
    owner_emitter_address: BytesN<32>,
    initial_guardian_set: Vec<BytesN<20>>,
    guardian_set_index: u32,
) -> Result<(), ContractError> {
    if env
        .storage()
        .instance()
        .has(&DataKey::Initialized)
    {
        return Err(ContractError::AlreadyInitialized);
    }

    env.storage()
        .instance()
        .set(&DataKey::Initialized, &true);
    env.storage()
        .persistent()
        .set(&DataKey::GuardianSet, &initial_guardian_set);
    env.storage()
        .persistent()
        .set(&DataKey::GuardianSetIndex, &guardian_set_index);
    env.storage()
        .instance()
        .set(&DataKey::ChainId, &chain_id);
    env.storage()
        .instance()
        .set(&DataKey::OwnerEmitterChain, &owner_emitter_chain);
    env.storage()
        .instance()
        .set(&DataKey::OwnerEmitterAddress, &owner_emitter_address);
    env.storage()
        .persistent()
        .set(&DataKey::LastExecutedSequence, &0u64);

    // Extend TTL for all persistent entries.
    extend_guardian_set_ttl(env);
    extend_instance_ttl(env);

    Ok(())
}

/// Check that the contract has been initialized.
pub fn require_initialized(env: &Env) -> Result<(), ContractError> {
    if !env
        .storage()
        .instance()
        .has(&DataKey::Initialized)
    {
        return Err(ContractError::NotInitialized);
    }
    Ok(())
}

/// Get the current guardian set.
pub fn get_guardian_set(env: &Env) -> Vec<BytesN<20>> {
    extend_guardian_set_ttl(env);
    env.storage()
        .persistent()
        .get(&DataKey::GuardianSet)
        .expect("guardian set not found")
}

/// Get the current guardian set index.
pub fn get_guardian_set_index(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::GuardianSetIndex)
        .expect("guardian set index not found")
}

/// Get the chain ID.
pub fn get_chain_id(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::ChainId)
        .expect("chain id not found")
}

/// Get the owner emitter chain ID.
pub fn get_owner_emitter_chain(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::OwnerEmitterChain)
        .expect("owner emitter chain not found")
}

/// Get the owner emitter address.
pub fn get_owner_emitter_address(env: &Env) -> BytesN<32> {
    env.storage()
        .instance()
        .get(&DataKey::OwnerEmitterAddress)
        .expect("owner emitter address not found")
}

/// Get the last executed sequence number.
pub fn get_last_executed_sequence(env: &Env) -> u64 {
    env.storage()
        .persistent()
        .get(&DataKey::LastExecutedSequence)
        .unwrap_or(0u64)
}

/// Set the last executed sequence number.
pub fn set_last_executed_sequence(env: &Env, sequence: u64) {
    env.storage()
        .persistent()
        .set(&DataKey::LastExecutedSequence, &sequence);
}

/// Update the guardian set. Stores the new set and increments the index.
pub fn store_guardian_set(
    env: &Env,
    new_guardian_set: Vec<BytesN<20>>,
    new_index: u32,
) {
    env.storage()
        .persistent()
        .set(&DataKey::GuardianSet, &new_guardian_set);
    env.storage()
        .persistent()
        .set(&DataKey::GuardianSetIndex, &new_index);
    extend_guardian_set_ttl(env);
}

/// Derive an Ethereum address from an uncompressed secp256k1 public key.
///
/// The uncompressed key is 65 bytes: `0x04 || x (32) || y (32)`.
/// The Ethereum address is `keccak256(x || y)[12..32]`.
pub fn eth_address_from_pubkey(env: &Env, uncompressed: &BytesN<65>) -> BytesN<20> {
    // Get x || y (skip the 0x04 prefix byte).
    let raw_key = env.crypto().keccak256(
        &soroban_sdk::Bytes::from_slice(env, &uncompressed.to_array()[1..65]),
    );
    let hash_array = raw_key.to_array();
    let mut addr = [0u8; 20];
    addr.copy_from_slice(&hash_array[12..32]);
    BytesN::from_array(env, &addr)
}

/// Compute the quorum threshold: 2/3 + 1 of the guardian set size.
///
/// Uses the same fixed-point formula as the EVM implementation:
/// `(((num_guardians * 10) / 3) * 2) / 10 + 1`
pub fn quorum(num_guardians: u32) -> u32 {
    (((num_guardians * 10) / 3) * 2) / 10 + 1
}

/// Extend TTL on guardian set persistent storage entries.
fn extend_guardian_set_ttl(env: &Env) {
    env.storage().persistent().extend_ttl(
        &DataKey::GuardianSet,
        TTL_THRESHOLD,
        TTL_EXTEND_TO,
    );
    env.storage().persistent().extend_ttl(
        &DataKey::GuardianSetIndex,
        TTL_THRESHOLD,
        TTL_EXTEND_TO,
    );
    env.storage().persistent().extend_ttl(
        &DataKey::LastExecutedSequence,
        TTL_THRESHOLD,
        TTL_EXTEND_TO,
    );
}

/// Extend TTL on the contract instance storage.
pub fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}
