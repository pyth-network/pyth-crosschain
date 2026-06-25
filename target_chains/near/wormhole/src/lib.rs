//! Pyth-owned Wormhole core bridge for NEAR.
//!
//! Vendored from wormhole-foundation/wormhole `near/contracts/wormhole` (see `VENDOR.md` for the
//! pinned upstream commit). This is the **core bridge only**: VAA verification, the guardian-set
//! state machine, the `UpgradeGuardianSet` governance VAA, and the contract-upgrade governance
//! VAA. The message-publishing path (`publish_message`/`register_emitter`), the message-fee /
//! `transfer_fee` governance actions, and the token bridge are intentionally dropped — the Pyth
//! NEAR receiver only ever calls `verify_vaa`.
//!
//! Two deliberate deltas from upstream (documented in `VENDOR.md`):
//!   1. Guardian set index 0 is initialized in `new()` with the Pyth Pro router set instead of
//!      being booted by the contract owner.
//!   2. `GuardianSetInfo::quorum` is a simple majority (`n/2 + 1`) so the 5-router set verifies at
//!      3-of-5, rather than Wormhole's `2n/3 + 1` (which would require 4-of-5).
//! Everything else — the VAA wire format, the rotation flow, and the guardian-set grace period —
//! is preserved verbatim.

use {
    crate::byte_utils::ByteUtils,
    near_sdk::{
        borsh::{BorshDeserialize, BorshSerialize},
        collections::{LookupMap, UnorderedSet},
        env, near_bindgen, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue,
    },
};

pub mod byte_utils;
pub mod state;

const CHAIN_ID_NEAR: u16 = 15;
const CHAIN_ID_SOL: u16 = 1;

/// Wormhole's guardian-set grace period: a rotated-out set stays valid for this long so VAAs that
/// were in flight across a rotation still verify. 24 hours, in nanoseconds.
const GUARDIAN_SET_EXPIRITY: u64 = 24 * 60 * 60 * 1_000_000_000;

#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub struct GuardianAddress {
    pub bytes: Vec<u8>,
}

#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub struct GuardianSetInfo {
    pub addresses: Vec<GuardianAddress>,
    pub expiration_time: u64, // Guardian set expiration time
}

impl GuardianSetInfo {
    /// Number of signatures required to accept a VAA. Pyth delta: a simple majority of the router
    /// set (3-of-5), rather than upstream Wormhole's `2n/3 + 1` (which would be 4-of-5).
    pub fn quorum(&self) -> usize {
        self.addresses.len() / 2 + 1
    }
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
#[borsh(crate = "near_sdk::borsh")]
pub struct Wormhole {
    guardians: LookupMap<u32, GuardianSetInfo>,
    dups: UnorderedSet<Vec<u8>>,
    guardian_set_expirity: u64,
    guardian_set_index: u32,
    upgrade_hash: Vec<u8>,
}

#[near_bindgen]
impl Wormhole {
    /// Initialize guardian set index 0.
    ///
    /// `initial_guardians` are the 20-byte secp256k1 guardian addresses (keccak256(pubkey)[12..],
    /// the standard Wormhole/Ethereum address derivation) as hex strings.
    ///
    /// TODO(deployment): supply the 5 Pyth Pro router pubkeys here at deploy time. They are not
    /// hardcoded — `jayantk` provides them when the contract is created.
    #[init]
    pub fn new(initial_guardians: Vec<String>) -> Self {
        let addresses = initial_guardians
            .iter()
            .map(|address| GuardianAddress {
                bytes: hex::decode(address).expect("invalid guardian address"),
            })
            .collect::<Vec<GuardianAddress>>();

        let mut guardians = LookupMap::new(b"gs".to_vec());
        guardians.insert(
            &0,
            &GuardianSetInfo {
                addresses,
                expiration_time: 0,
            },
        );

        Self {
            guardians,
            dups: UnorderedSet::new(b"d".to_vec()),
            guardian_set_expirity: GUARDIAN_SET_EXPIRITY,
            guardian_set_index: 0,
            upgrade_hash: b"".to_vec(),
        }
    }

    // I like passing the vaa's as strings around since it will show
    // up better in explorers... I'll let a near sensai talk me out
    // of this...
    pub fn verify_vaa(&self, vaa: String) -> u32 {
        let h = hex::decode(vaa).expect("invalidVaa");
        self.parse_and_verify_vaa(&h);
        self.guardian_set_index
    }

    #[payable]
    pub fn submit_vaa(&mut self, vaa: String) -> PromiseOrValue<bool> {
        let refund_to = env::predecessor_account_id();
        let mut deposit = env::attached_deposit();

        if deposit.is_zero() {
            env::panic_str("PayForSelf");
        }

        if env::prepaid_gas().as_gas() < Gas::from_tgas(140).as_gas() {
            env::panic_str("NotEnoughGas");
        }

        let h = hex::decode(vaa).expect("invalidVaa");
        let vaa = self.parse_and_verify_vaa(&h);

        // Check if VAA with this hash was already accepted
        if self.dups.contains(&vaa.hash) {
            env::panic_str("alreadyExecuted");
        }

        let storage_used = env::storage_usage();
        self.dups.insert(&vaa.hash);
        let required_cost = env::storage_byte_cost()
            .checked_mul((env::storage_usage() - storage_used) as u128)
            .unwrap();

        if required_cost > deposit {
            env::panic_str("DepositUnderflowForDupSuppression");
        }
        deposit = deposit.saturating_sub(required_cost);

        if (CHAIN_ID_SOL != vaa.emitter_chain)
            || (hex::decode("0000000000000000000000000000000000000000000000000000000000000004")
                .unwrap()
                != vaa.emitter_address)
        {
            env::panic_str("InvalidGovernanceEmitter");
        }

        // This is the core contract... it SHOULD only get governance packets and be on the latest
        if self.guardian_set_index != vaa.guardian_set_index {
            env::panic_str("InvalidGovernanceSet");
        }

        let data: &[u8] = &vaa.payload;

        if data[0..32]
            != hex::decode("00000000000000000000000000000000000000000000000000000000436f7265")
                .unwrap()
        {
            env::panic_str("InvalidGovernanceModule");
        }

        let chain = data.get_u16(33);
        let action = data.get_u8(32);

        if !((action == 2 && chain == 0) || chain == CHAIN_ID_NEAR) {
            env::panic_str("InvalidGovernanceChain");
        }

        let payload = &data[35..];

        match action {
            1u8 => self.vaa_update_contract(&vaa, payload, deposit, refund_to),
            2u8 => self.vaa_update_guardian_set(&vaa, payload, deposit, refund_to),
            _ => env::panic_str("InvalidGovernanceAction"),
        }
    }

    #[private]
    pub fn update_contract_done(
        &mut self,
        refund_to: AccountId,
        storage_used: u64,
        attached_deposit: NearToken,
    ) {
        let now = env::storage_usage();
        let delta = if now > storage_used {
            env::storage_byte_cost()
                .checked_mul((now - storage_used) as u128)
                .unwrap()
        } else {
            NearToken::from_yoctonear(0)
        };

        let refund = attached_deposit.saturating_sub(delta);
        if !refund.is_zero() {
            env::log_str(&format!(
                "wormhole/{}#{}: update_contract_done: refund {} to {}",
                file!(),
                line!(),
                refund,
                refund_to
            ));
            Promise::new(refund_to).transfer(refund);
        }
    }

    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        env::log_str(&format!("wormhole/{}#{}: migrate", file!(), line!()));
        let state: Wormhole = env::state_read().expect("failed");
        state
    }
}

impl Wormhole {
    fn parse_and_verify_vaa(&self, data: &[u8]) -> state::ParsedVAA {
        let vaa = state::ParsedVAA::parse(data);
        if vaa.version != 1 {
            env::panic_str("InvalidVersion");
        }
        let guardian_set = self
            .guardians
            .get(&vaa.guardian_set_index)
            .expect("InvalidGuardianSetIndex");

        if guardian_set.expiration_time != 0
            && guardian_set.expiration_time < env::block_timestamp()
        {
            env::panic_str("GuardianSetExpired");
        }

        if vaa.len_signers < guardian_set.quorum() {
            env::panic_str("ContractError");
        }

        // Lets calculate the digest that we are comparing against
        let mut pos =
            state::ParsedVAA::HEADER_LEN + (vaa.len_signers * state::ParsedVAA::SIGNATURE_LEN);
        let p1 = env::keccak256(&data[pos..]);
        let digest = env::keccak256(&p1);

        // Verify guardian signatures
        let mut last_index: i32 = -1;
        pos = state::ParsedVAA::HEADER_LEN;

        for _ in 0..vaa.len_signers {
            // which guardian signature is this?
            let index = data.get_u8(pos) as i32;

            // We can't go backwards or use the same guardian over again
            if index <= last_index {
                env::panic_str("WrongGuardianIndexOrder");
            }
            last_index = index;

            pos += 1; // walk forward

            // Grab the whole signature
            let signature = &data[(pos)..(pos + state::ParsedVAA::SIG_DATA_LEN)];
            let key = guardian_set.addresses.get(index as usize).unwrap();

            pos += state::ParsedVAA::SIG_DATA_LEN;
            let recovery = data.get_u8(pos);

            let v = env::ecrecover(&digest, signature, recovery, true).expect("cannot recover key");
            let k = &env::keccak256(&v)[12..32];
            if k != key.bytes {
                env::log_str(&format!(
                    "wormhole/{}#{}: signature_error: {} != {}",
                    file!(),
                    line!(),
                    hex::encode(k),
                    hex::encode(&key.bytes),
                ));

                env::panic_str("GuardianSignatureError");
            }
            pos += 1;
        }

        vaa
    }

    fn vaa_update_contract(
        &mut self,
        _vaa: &state::ParsedVAA,
        data: &[u8],
        deposit: NearToken,
        refund_to: AccountId,
    ) -> PromiseOrValue<bool> {
        let uh = data.get_bytes32(0);
        env::log_str(&format!(
            "wormhole/{}#{}: vaa_update_contract: {}",
            file!(),
            line!(),
            hex::encode(uh)
        ));
        self.upgrade_hash = uh.to_vec();

        if !deposit.is_zero() {
            PromiseOrValue::Promise(Promise::new(refund_to).transfer(deposit))
        } else {
            PromiseOrValue::Value(true)
        }
    }

    fn vaa_update_guardian_set(
        &mut self,
        _vaa: &state::ParsedVAA,
        data: &[u8],
        mut deposit: NearToken,
        refund_to: AccountId,
    ) -> PromiseOrValue<bool> {
        const ADDRESS_LEN: usize = 20;
        let new_guardian_set_index = data.get_u32(0);

        if self.guardian_set_index + 1 != new_guardian_set_index {
            env::panic_str("InvalidGovernanceSetIndex");
        }

        let n_guardians = data.get_u8(4);

        let mut addresses = vec![];

        for i in 0..n_guardians {
            let pos = 5 + (i as usize) * ADDRESS_LEN;
            addresses.push(GuardianAddress {
                bytes: data[pos..pos + ADDRESS_LEN].to_vec(),
            });
        }

        // Set the grace-period expiry on the now-previous guardian set so in-flight VAAs signed by
        // it still verify until it lapses.
        let guardian_set = &mut self
            .guardians
            .get(&self.guardian_set_index)
            .expect("InvalidPreviousGuardianSetIndex");

        guardian_set.expiration_time = env::block_timestamp() + self.guardian_set_expirity;

        self.guardians
            .insert(&self.guardian_set_index, guardian_set);

        let g = GuardianSetInfo {
            addresses,
            expiration_time: 0,
        };

        let storage_used = env::storage_usage();

        self.guardians.insert(&new_guardian_set_index, &g);
        self.guardian_set_index = new_guardian_set_index;

        let required_cost = env::storage_byte_cost()
            .checked_mul((env::storage_usage() - storage_used) as u128)
            .unwrap();

        if required_cost > deposit {
            env::panic_str("DepositUnderflowForGuardianSet");
        }
        deposit = deposit.saturating_sub(required_cost);

        if !deposit.is_zero() {
            PromiseOrValue::Promise(Promise::new(refund_to).transfer(deposit))
        } else {
            PromiseOrValue::Value(true)
        }
    }

    fn update_contract_work(&mut self, v: Vec<u8>) -> Promise {
        let s = env::sha256(&v);

        env::log_str(&format!(
            "wormhole/{}#{}: update_contract: {}",
            file!(),
            line!(),
            hex::encode(&s)
        ));

        if s.to_vec() != self.upgrade_hash {
            env::panic_str("invalidUpgradeContract");
        }

        let storage_cost = env::storage_byte_cost()
            .checked_mul((v.len() + 32) as u128)
            .unwrap();
        assert!(
            env::attached_deposit() >= storage_cost,
            "DepositUnderFlow:{}",
            storage_cost
        );

        Promise::new(env::current_account_id())
            .deploy_contract(v)
            .then(Self::ext(env::current_account_id()).migrate())
            .then(Self::ext(env::current_account_id()).update_contract_done(
                env::predecessor_account_id(),
                env::storage_usage(),
                env::attached_deposit(),
            ))
    }
}

// Gated to wasm32 like near-sdk's generated entry points: on the host target (unit tests, ABI
// extraction) this raw entry point is never invoked, and leaving it ungated would keep its
// cross-contract `deploy_contract`/`migrate` promise calls alive past dead-code elimination,
// leaving undefined NEAR host symbols that break `cargo near`'s ABI dylib step.
#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn update_contract() {
    env::setup_panic_hook();
    let mut contract: Wormhole = env::state_read().expect("Contract is not initialized");
    contract.update_contract_work(env::input().unwrap());
}
