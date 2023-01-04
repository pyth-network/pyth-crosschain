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
    byteorder::{
        BigEndian,
        ReadBytesExt,
        WriteBytesExt,
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
        serde::{
            Deserialize,
            Serialize,
        },
        AccountId,
        Gas,
        Promise,
    },
    std::io::Read,
    wormhole::Chain as WormholeChain,
};

/// Magic Header for identifying Governance VAAs.
const GOVERNANCE_MAGIC: [u8; 4] = [0x50, 0x54, 0x47, 0x4d];

/// ID for the module this contract identifies as: Pyth Receiver (0x1).
const GOVERNANCE_MODULE: u8 = 0x01;

/// Enumeration of IDs for different governance actions.
#[repr(u8)]
pub enum ActionId {
    ContractUpgrade        = 0,
    SetDataSources         = 1,
    SetGovernanceSource    = 2,
    SetStalePriceThreshold = 3,
    SetUpdateFee           = 4,
}

impl TryInto<ActionId> for u8 {
    type Error = Error;
    fn try_into(self) -> Result<ActionId, Error> {
        match self {
            0 => Ok(ActionId::ContractUpgrade),
            1 => Ok(ActionId::SetDataSources),
            2 => Ok(ActionId::SetGovernanceSource),
            3 => Ok(ActionId::SetStalePriceThreshold),
            4 => Ok(ActionId::SetUpdateFee),
            _ => Err(Error::InvalidPayload),
        }
    }
}

impl From<ActionId> for u8 {
    fn from(val: ActionId) -> Self {
        val as u8
    }
}

/// A `GovernanceAction` represents the different actions that can be voted on and executed by the
/// governance system.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub enum GovernanceAction {
    ContractUpgrade([u8; 32]),
    SetDataSources(Vec<Source>),
    SetGovernanceSource(Source),
    SetStalePriceThreshold(u64),
    SetUpdateFee(u64),
}

impl GovernanceAction {
    pub fn id(&self) -> ActionId {
        match self {
            GovernanceAction::ContractUpgrade(_) => ActionId::ContractUpgrade,
            GovernanceAction::SetDataSources(_) => ActionId::SetDataSources,
            GovernanceAction::SetGovernanceSource(_) => ActionId::SetGovernanceSource,
            GovernanceAction::SetStalePriceThreshold(_) => ActionId::SetStalePriceThreshold,
            GovernanceAction::SetUpdateFee(_) => ActionId::SetUpdateFee,
        }
    }

    pub fn deserialize(data: &[u8]) -> Result<Self, Error> {
        let mut cursor = std::io::Cursor::new(data);
        let magic = cursor.read_u32::<BigEndian>()?;
        let module = cursor.read_u8()?;
        let action = cursor.read_u8()?.try_into()?;
        let target = cursor.read_u16::<BigEndian>()?;

        assert!(module == GOVERNANCE_MODULE);
        assert!(target == 0 || target == u16::from(WormholeChain::Near));
        assert!(magic == u32::from_le_bytes(GOVERNANCE_MAGIC));

        Ok(match action {
            ActionId::ContractUpgrade => {
                let mut hash = [0u8; 32];
                cursor.read_exact(&mut hash)?;
                Self::ContractUpgrade(hash)
            }

            ActionId::SetDataSources => {
                let mut sources = Vec::new();
                let count = cursor.read_u8()?;

                for _ in 0..count {
                    let mut emitter = [0u8; 32];
                    cursor.read_exact(&mut emitter)?;
                    sources.push(Source {
                        emitter,
                        pyth_emitter_chain: Chain::from(WormholeChain::from(
                            cursor.read_u16::<BigEndian>()?,
                        )),
                    });
                }

                Self::SetDataSources(sources)
            }

            ActionId::SetGovernanceSource => {
                let mut emitter = [0u8; 32];
                cursor.read_exact(&mut emitter)?;
                Self::SetGovernanceSource(Source {
                    emitter,
                    pyth_emitter_chain: Chain(cursor.read_u16::<BigEndian>()?),
                })
            }

            ActionId::SetStalePriceThreshold => {
                let stale_price_threshold = cursor.read_u64::<BigEndian>()?;
                Self::SetStalePriceThreshold(stale_price_threshold)
            }

            ActionId::SetUpdateFee => {
                let update_fee = cursor.read_u64::<BigEndian>()?;
                Self::SetUpdateFee(update_fee)
            }
        })
    }

    pub fn serialize(&self) -> Vec<u8> {
        let mut data = Vec::new();
        let magic = u32::from_le_bytes(GOVERNANCE_MAGIC);
        data.write_u32::<BigEndian>(magic).unwrap();
        data.push(GOVERNANCE_MODULE);
        data.push(self.id() as u8);
        data.extend_from_slice(&0u16.to_le_bytes());

        match self {
            Self::ContractUpgrade(hash) => {
                data.extend_from_slice(hash);
            }

            Self::SetDataSources(sources) => {
                data.push(sources.len() as u8);
                for source in sources {
                    data.extend_from_slice(&source.emitter);
                    data.extend_from_slice(&source.pyth_emitter_chain.0.to_le_bytes());
                }
            }

            Self::SetGovernanceSource(source) => {
                data.extend_from_slice(&source.emitter);
                data.extend_from_slice(&source.pyth_emitter_chain.0.to_le_bytes());
            }

            Self::SetStalePriceThreshold(stale_price_threshold) => {
                data.extend_from_slice(&stale_price_threshold.to_le_bytes());
            }

            Self::SetUpdateFee(update_fee) => {
                data.extend_from_slice(&update_fee.to_le_bytes());
            }
        }

        data
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
            let vaa = serde_wormhole::from_slice_with_payload::<wormhole::Vaa<()>>(&vaa);
            let vaa = vaa.map_err(|_| Error::InvalidVaa)?;
            let (vaa, _rest) = vaa;

            // Convert to local VAA type to catch APi changes.
            let vaa = Vaa::from(vaa);

            // Prevent VAA re-execution.
            if self.executed_gov_sequences.contains(&vaa.sequence) {
                return Err(Error::VaaVerificationFailed);
            }

            // Confirm the VAA is coming from a trusted source chain.
            if self.gov_source
                != (Source {
                    emitter:            vaa.emitter_address,
                    pyth_emitter_chain: vaa.emitter_chain,
                })
            {
                return Err(Error::UnknownSource);
            }

            // Insert before calling Wormhole to prevent re-execution. If we wait until after the
            // Wormhole call we could end up with multiple VAA's with the same sequence being
            // executed in parallel.
            self.executed_gov_sequences.insert(&vaa.sequence);
        }

        // Verify VAA and refund the caller in case of failure.
        ext_wormhole::ext(self.wormhole.clone())
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
    #[payable]
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
        let (_, rest): (wormhole::Vaa<()>, _) =
            serde_wormhole::from_slice_with_payload(&vaa).map_err(|_| Error::InvalidPayload)?;

        match GovernanceAction::deserialize(rest)? {
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

    /// If submitting an action fails then this callback will refund the caller.
    #[private]
    pub fn refund_vaa(&mut self, account_id: AccountId, amount: u128) {
        if !is_promise_success() {
            // No calculations needed as deposit size will have not changed. Can just refund the
            // whole deposit amount.
            Promise::new(account_id).transfer(amount);
        }
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
    pub fn set_update_fee(&mut self, fee: u64) {
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
