//! Implement Governance Processing

use {
    crate::{
        error::Error,
        ext::ext_wormhole,
        state::{
            Chain,
            Source,
            Vaa,
        },
        Pyth,
        PythExt,
    },
    near_sdk::{
        borsh::{
            self,
            BorshDeserialize,
            BorshSerialize,
        },
        env,
        is_promise_success,
        near_bindgen,
        AccountId,
        Balance,
        Gas,
        Promise,
    },
    std::io::Read,
    structs::Chain as WormholeChain,
    uint::byteorder::{
        LittleEndian,
        ReadBytesExt,
    },
};

/// A `GovernanceAction` represents the different actions that can be voted on and executed by the
/// governance system.
#[derive(BorshDeserialize, BorshSerialize)]
pub enum GovernanceAction {
    ContractUpgrade([u8; 32]),
    SetDataSources(Vec<Source>),
    SetGovernanceSource(Source),
    SetStalePriceThreshold(u64),
    SetUpdateFee(Balance),
}

const GOVERNANCE_MAGIC: &[u8] = b"5054474d";
const GOVERNANCE_MODULE: u8 = 0x01;

impl GovernanceAction {
    fn deserialize(data: &[u8]) -> Self {
        let mut cursor = std::io::Cursor::new(data);
        let magic = cursor.read_u32::<LittleEndian>().unwrap();
        let module: u8 = cursor.read_u8().unwrap();
        let action: u8 = cursor.read_u8().unwrap();
        let target: u16 = cursor.read_u16::<LittleEndian>().unwrap();

        assert!(magic == u32::from_le_bytes(GOVERNANCE_MAGIC.try_into().unwrap()));
        assert!(module == GOVERNANCE_MODULE);
        assert!(target == 0 || target == WormholeChain::Near as u16);

        match action {
            0 => {
                let mut hash = [0u8; 32];
                cursor.read_exact(&mut hash).unwrap();
                Self::ContractUpgrade(hash)
            }

            1 => {
                let mut sources = Vec::new();
                let count = cursor.read_u32::<LittleEndian>().unwrap();
                for _ in 0..count {
                    let mut emitter = [0u8; 32];
                    cursor.read_exact(&mut emitter).unwrap();
                    let pyth_emitter_chain = Chain::from(WormholeChain::Solana);
                    sources.push(Source {
                        emitter,
                        pyth_emitter_chain,
                    });
                }
                Self::SetDataSources(sources)
            }

            2 => {
                let mut emitter = [0u8; 32];
                cursor.read_exact(&mut emitter).unwrap();
                let pyth_emitter_chain = Chain(cursor.read_u16::<LittleEndian>().unwrap());
                Self::SetGovernanceSource(Source {
                    emitter,
                    pyth_emitter_chain,
                })
            }

            3 => {
                let stale_price_threshold = cursor.read_u64::<LittleEndian>().unwrap();
                Self::SetStalePriceThreshold(stale_price_threshold)
            }

            4 => {
                let update_fee = cursor.read_u128::<LittleEndian>().unwrap();
                Self::SetUpdateFee(update_fee)
            }

            _ => unreachable!(),
        }
    }
}

#[near_bindgen]
impl Pyth {
    /// Instruction for processing Governance VAA's relayed via Wormhole.
    ///
    /// Note that VAA verification requires calling Wormhole so processing of the VAA itself is
    /// done in a callback handler, see `process_vaa_callback`.
    #[payable]
    #[handle_result]
    pub fn execute_governance_instruction(&mut self, vaa: String) -> Result<(), Error> {
        // Verify the VAA is coming from a trusted source chain before attempting to verify VAA
        // signatures. Avoids a cross-contract call early.
        {
            let vaa = hex::decode(&vaa).map_err(|_| Error::InvalidHex)?;
            let vaa = vaa_payload::from_slice_with_payload::<structs::Vaa<()>>(&vaa);
            let vaa = vaa.map_err(|_| Error::InvalidVaa)?;
            let (vaa, _rest) = vaa;

            // Convert to local VAA type to catch APi changes.
            let vaa = Vaa::from(vaa);

            if vaa.sequence <= self.last_gov_seq {
                return Err(Error::VaaVerificationFailed);
            }

            self.last_gov_seq = vaa.sequence;

            if self.gov_source
                != (Source {
                    emitter:            vaa.emitter_address,
                    pyth_emitter_chain: vaa.emitter_chain,
                })
            {
                return Err(Error::UnknownSource);
            }
        }

        // Verify VAA and refund the caller in case of failure.
        ext_wormhole::ext(env::current_account_id())
            .with_static_gas(Gas(30_000_000_000_000))
            .verify_vaa(vaa.clone())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas(30_000_000_000_000))
                    .with_attached_deposit(env::attached_deposit())
                    .verify_gov_vaa_callback(env::predecessor_account_id(), vaa),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas(30_000_000_000_000))
                    .refund_vaa(env::predecessor_account_id(), env::attached_deposit()),
            );

        Ok(())
    }

    /// Invoke handler upon successful verification of a VAA action.
    #[private]
    #[handle_result]
    pub fn verify_gov_vaa_callback(
        &mut self,
        account_id: AccountId,
        vaa: String,
        #[callback_result] _result: Result<u32, near_sdk::PromiseError>,
    ) -> Result<(), Error> {
        use GovernanceAction::*;

        if !is_promise_success() {
            return Err(Error::VaaVerificationFailed);
        }

        // Get Storage Usage before execution.
        let storage = env::storage_usage();

        // Deserialize VAA, note that we already deserialized and verified the VAA in `process_vaa`
        // at this point so we only care about the `rest` component which contains bytes we can
        // deserialize into an Action.
        let vaa = hex::decode(&vaa).unwrap();
        let (_, rest): (structs::Vaa<()>, _) = vaa_payload::from_slice_with_payload(&vaa).unwrap();

        match GovernanceAction::deserialize(rest) {
            ContractUpgrade(codehash) => self.set_upgrade_hash(codehash),
            SetDataSources(sources) => self.set_sources(sources),
            SetGovernanceSource(source) => self.set_gov_source(source),
            SetStalePriceThreshold(threshold) => self.set_stale_price_threshold(threshold),
            SetUpdateFee(fee) => self.set_update_fee(fee),
        }

        // Refund storage difference to `account_id` after storage execution.
        self.refund_storage_usage(
            account_id,
            storage,
            env::storage_usage(),
            env::attached_deposit(),
        )
    }

    #[private]
    pub fn set_upgrade_hash(&mut self, codehash: [u8; 32]) {
        self.codehash = codehash;
    }

    #[private]
    pub fn set_gov_source(&mut self, source: Source) {
        self.gov_source = source;
    }

    #[private]
    pub fn set_stale_price_threshold(&mut self, threshold: u64) {
        self.stale_threshold = threshold;
    }

    #[private]
    pub fn set_update_fee(&mut self, fee: Balance) {
        self.update_fee = fee;
    }

    #[private]
    #[handle_result]
    pub fn set_sources(&mut self, sources: Vec<Source>) {
        self.sources.clear();
        sources.iter().for_each(|s| {
            self.sources.insert(s);
        });
    }

    /// If submitting an action fails then this callback will refund the caller.
    #[private]
    pub fn refund_vaa(&mut self, account_id: AccountId, amount: u128) {
        if !is_promise_success() {
            // No calculations needed as deposit size will have not changed. Can just refund the
            // whole deposit amount.
            Promise::new(account_id).transfer(amount);
        }
    }

    /// This method allows self-upgrading the contract to a new implementation.
    ///
    /// This function is open to call by anyone, but to perform an authorized upgrade a VAA
    /// containing the hash of the `new_code` must have previously been relayed to this contract's
    /// `process_vaa` endpoint. otherwise the upgrade will fail.
    ///
    /// NOTE: This function is pub only within crate scope so that it can only be called by the
    /// `upgrade_contract` method, this is much much cheaper than serializing a Vec<u8> to call
    /// this method as a normal public method.
    #[handle_result]
    pub(crate) fn upgrade(&mut self, new_code: Vec<u8>) -> Result<Promise, Error> {
        let signature = env::sha256(&new_code);

        if signature != self.codehash {
            return Err(Error::UnauthorizedUpgrade);
        }

        Ok(Promise::new(env::current_account_id())
            .deploy_contract(new_code)
            .then(Self::ext(env::current_account_id()).refund_upgrade(
                env::predecessor_account_id(),
                env::attached_deposit(),
                env::storage_usage(),
            )))
    }

    /// This method is called after the upgrade to refund the caller for the storage used by the
    /// old contract.
    #[private]
    #[handle_result]
    pub fn refund_upgrade(
        &mut self,
        account_id: AccountId,
        amount: u128,
        storage: u64,
    ) -> Result<(), Error> {
        self.refund_storage_usage(account_id, storage, env::storage_usage(), amount)
    }
}

impl Pyth {
    #[allow(dead_code)]
    fn is_valid_governance_source(&self, source: &Source) -> Result<(), Error> {
        (self.gov_source == *source)
            .then_some(())
            .ok_or(Error::UnknownSource)
    }
}
