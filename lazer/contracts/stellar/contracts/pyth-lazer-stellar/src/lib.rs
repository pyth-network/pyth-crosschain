#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env};

mod bytes;
mod error;
pub mod payload;
mod state;
mod verify;

#[cfg(test)]
mod test;

pub use error::ContractError;

#[contract]
pub struct PythLazerContract;

#[contractimpl]
impl PythLazerContract {
    /// One-time initialization. Stores the executor address (the Wormhole executor
    /// contract authorized for governance operations).
    ///
    /// Optionally accepts an initial trusted signer and expiry. This avoids
    /// needing a governance VAA for the very first signer during deployment.
    pub fn initialize(
        env: Env,
        executor: Address,
        initial_signer: Option<BytesN<33>>,
        initial_signer_expires_at: Option<u64>,
    ) -> Result<(), ContractError> {
        if state::has_executor(&env) {
            return Err(ContractError::AlreadyInitialized);
        }
        state::set_executor(&env, &executor);
        if let (Some(pubkey), Some(expires_at)) = (initial_signer, initial_signer_expires_at) {
            state::set_trusted_signer(&env, &pubkey, expires_at);
        }
        state::extend_instance_ttl(&env);
        Ok(())
    }

    /// Verify an LE-ECDSA signed Pyth Lazer update.
    ///
    /// Parses the envelope, recovers the signer's public key, checks it against
    /// trusted signers, validates expiry, and returns the verified payload bytes.
    pub fn verify_update(env: Env, data: Bytes) -> Result<Bytes, ContractError> {
        state::extend_instance_ttl(&env);
        verify::verify_update(&env, &data)
    }

    /// Add, update, or remove a trusted signer. Callable only by the executor.
    /// Setting `expires_at` to 0 removes the signer.
    pub fn update_trusted_signer(
        env: Env,
        pubkey: BytesN<33>,
        expires_at: u64,
    ) -> Result<(), ContractError> {
        let executor = state::get_executor(&env)?;
        executor.require_auth();
        state::set_trusted_signer(&env, &pubkey, expires_at);
        state::extend_instance_ttl(&env);
        Ok(())
    }

    /// Upgrade the contract WASM. Callable only by the executor.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), ContractError> {
        let executor = state::get_executor(&env)?;
        executor.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}
