use soroban_sdk::{contracttype, Address, BytesN, Env};

/// TTL threshold: extend when TTL drops below this (approx 6 days at 5s/ledger).
pub const TTL_THRESHOLD: u32 = 100_000;
/// TTL extension target (approx 29 days at 5s/ledger).
pub const TTL_EXTEND_TO: u32 = 500_000;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// The executor address authorized for governance operations.
    Executor,
    /// Trusted signer entry: maps compressed secp256k1 pubkey to expiry timestamp.
    TrustedSigner(BytesN<33>),
}

/// Store the executor address (one-time initialization).
pub fn set_executor(env: &Env, executor: &Address) {
    env.storage().instance().set(&DataKey::Executor, executor);
}

/// Read the executor address. Panics if not initialized.
pub fn get_executor(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Executor).unwrap()
}

/// Check whether the contract has been initialized.
pub fn has_executor(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Executor)
}

/// Store or update a trusted signer's expiry timestamp (unix seconds).
/// If `expires_at` is 0, removes the signer.
pub fn set_trusted_signer(env: &Env, pubkey: &BytesN<33>, expires_at: u64) {
    let key = DataKey::TrustedSigner(pubkey.clone());
    if expires_at == 0 {
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &expires_at);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

/// Get a trusted signer's expiry timestamp. Returns None if not found.
pub fn get_trusted_signer_expiry(env: &Env, pubkey: &BytesN<33>) -> Option<u64> {
    let key = DataKey::TrustedSigner(pubkey.clone());
    let result: Option<u64> = env.storage().persistent().get(&key);
    if result.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    result
}

/// Extend TTL on instance storage (call on every user-facing invocation).
pub fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}
