#![no_std]

pub mod error;
pub mod governance;
pub mod guardian;
pub mod vaa;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env, IntoVal, Symbol, Vec};

use crate::error::ContractError;
use crate::governance::{parse_ptgm, GovernanceAction};
use crate::vaa::{parse_vaa, verify_vaa};

/// Wormhole core governance module identifier ("Core" right-aligned in 32 bytes).
const CORE_MODULE: [u8; 32] = *b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00Core";

/// Guardian set upgrade action ID.
const GUARDIAN_SET_UPGRADE_ACTION: u8 = 2;

#[contract]
pub struct WormholeExecutor;

#[contractimpl]
impl WormholeExecutor {
    /// Initialize the executor contract.
    ///
    /// Must be called exactly once. Sets up the guardian set, chain ID, and
    /// governance emitter configuration.
    pub fn initialize(
        env: Env,
        chain_id: u32,
        owner_emitter_chain: u32,
        owner_emitter_address: BytesN<32>,
        initial_guardian_set: Vec<BytesN<20>>,
        guardian_set_index: u32,
    ) -> Result<(), ContractError> {
        guardian::initialize(
            &env,
            chain_id,
            owner_emitter_chain,
            owner_emitter_address,
            initial_guardian_set,
            guardian_set_index,
        )
    }

    /// Process a guardian set upgrade VAA.
    ///
    /// This is a self-governance mechanism: the current guardian set signs a VAA
    /// that authorizes a new guardian set. The VAA payload follows the Wormhole
    /// core governance format:
    ///
    /// ```text
    /// [32 bytes] module ("Core" right-padded)
    /// [1 byte]   action (2 = guardian set upgrade)
    /// [2 bytes]  target chain (0 = all chains)
    /// [4 bytes]  new guardian set index (BE u32)
    /// [1 byte]   num guardians
    /// For each guardian:
    ///   [20 bytes] Ethereum address
    /// ```
    pub fn update_guardian_set(env: Env, vaa_bytes: Bytes) -> Result<(), ContractError> {
        guardian::require_initialized(&env)?;
        guardian::extend_instance_ttl(&env);

        // Parse and verify the VAA with current guardian set.
        let vaa = parse_vaa(&env, &vaa_bytes)?;
        verify_vaa(&env, &vaa)?;

        let payload = &vaa.body.payload;
        let payload_len = payload.len() as usize;

        // Minimum payload size: 32 (module) + 1 (action) + 2 (chain) + 4 (index) + 1 (num) = 40
        if payload_len < 40 {
            return Err(ContractError::TruncatedData);
        }

        // Verify module is "Core".
        let mut module_bytes = [0u8; 32];
        for i in 0..32 {
            module_bytes[i] = payload.get(i as u32).unwrap();
        }
        if module_bytes != CORE_MODULE {
            return Err(ContractError::InvalidEmitterAddress);
        }

        // Verify action is guardian set upgrade (2).
        let action = payload.get(32).unwrap();
        if action != GUARDIAN_SET_UPGRADE_ACTION {
            return Err(ContractError::InvalidEmitterChain);
        }

        // Target chain (2 bytes BE u16) - 0 means all chains.
        let target_chain = ((payload.get(33).unwrap() as u16) << 8)
            | (payload.get(34).unwrap() as u16);
        let our_chain = guardian::get_chain_id(&env);
        if target_chain != 0 && target_chain as u32 != our_chain {
            return Err(ContractError::InvalidEmitterChain);
        }

        // New guardian set index (4 bytes BE u32).
        let new_index = ((payload.get(35).unwrap() as u32) << 24)
            | ((payload.get(36).unwrap() as u32) << 16)
            | ((payload.get(37).unwrap() as u32) << 8)
            | (payload.get(38).unwrap() as u32);

        // Must increment by exactly 1.
        let current_index = guardian::get_guardian_set_index(&env);
        if new_index != current_index + 1 {
            return Err(ContractError::InvalidGuardianSetUpgrade);
        }

        // Number of guardians.
        let num_guardians = payload.get(39).unwrap() as usize;
        if num_guardians == 0 {
            return Err(ContractError::EmptyGuardianSet);
        }

        // Verify payload has enough data for all guardian addresses.
        let required_len = 40 + num_guardians * 20;
        if payload_len < required_len {
            return Err(ContractError::TruncatedData);
        }

        // Parse guardian Ethereum addresses.
        let mut new_guardian_set: Vec<BytesN<20>> = Vec::new(&env);
        for i in 0..num_guardians {
            let offset = 40 + i * 20;
            let mut addr = [0u8; 20];
            for j in 0..20 {
                addr[j] = payload.get((offset + j) as u32).unwrap();
            }
            new_guardian_set.push_back(BytesN::from_array(&env, &addr));
        }

        // Store the new guardian set.
        guardian::store_guardian_set(&env, new_guardian_set, new_index);

        Ok(())
    }

    /// Execute a governance action from a Wormhole VAA containing a PTGM payload.
    ///
    /// This verifies the VAA, validates the emitter matches the stored owner,
    /// enforces replay protection via strictly increasing sequence numbers,
    /// parses the PTGM governance instruction, and dispatches a cross-contract
    /// call to the target contract.
    pub fn execute_governance_action(
        env: Env,
        vaa_bytes: Bytes,
        target_contract: Address,
    ) -> Result<(), ContractError> {
        guardian::require_initialized(&env)?;
        guardian::extend_instance_ttl(&env);

        // Parse and verify the VAA with current guardian set.
        let vaa = parse_vaa(&env, &vaa_bytes)?;
        verify_vaa(&env, &vaa)?;

        // Validate emitter chain matches stored owner.
        let owner_chain = guardian::get_owner_emitter_chain(&env);
        if vaa.body.emitter_chain as u32 != owner_chain {
            return Err(ContractError::InvalidEmitterChain);
        }

        // Validate emitter address matches stored owner.
        let owner_address = guardian::get_owner_emitter_address(&env);
        if vaa.body.emitter_address != owner_address {
            return Err(ContractError::InvalidEmitterAddress);
        }

        // Replay protection: sequence must be strictly increasing.
        let last_sequence = guardian::get_last_executed_sequence(&env);
        if vaa.body.sequence <= last_sequence {
            return Err(ContractError::StaleSequence);
        }

        // Update last executed sequence.
        guardian::set_last_executed_sequence(&env, vaa.body.sequence);

        // Parse the PTGM governance instruction.
        let our_chain = guardian::get_chain_id(&env);
        let action = parse_ptgm(&vaa.body.payload, our_chain)?;

        // Dispatch cross-contract call to the target.
        match action {
            GovernanceAction::UpdateTrustedSigner(payload) => {
                let pubkey = BytesN::from_array(&env, &payload.pubkey);
                let args = (pubkey, payload.expires_at).into_val(&env);
                env.invoke_contract::<()>(
                    &target_contract,
                    &Symbol::new(&env, "update_trusted_signer"),
                    args,
                );
            }
            GovernanceAction::Upgrade(payload) => {
                let wasm_hash = BytesN::from_array(&env, &payload.wasm_digest);
                let args = (wasm_hash,).into_val(&env);
                env.invoke_contract::<()>(
                    &target_contract,
                    &Symbol::new(&env, "upgrade"),
                    args,
                );
            }
        }

        Ok(())
    }
}
