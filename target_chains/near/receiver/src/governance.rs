//! Implement Governance Processing

use {
    crate::{
        ensure,
        error::Error::{self, *},
        ext::ext_wormhole,
        state::{Chain, Source, Vaa},
        Pyth, PythExt,
    },
    near_sdk::{
        borsh::{BorshDeserialize, BorshSerialize},
        env, is_promise_success, near_bindgen,
        serde::{Deserialize, Serialize},
        AccountId, Gas, NearToken, Promise, PromiseOrValue,
    },
    num_traits::FromPrimitive,
    serde_wormhole::RawMessage,
    strum::EnumDiscriminants,
    wormhole_sdk::Chain as WormholeChain,
};

/// Magic Header for identifying Governance VAAs.
const GOVERNANCE_MAGIC: [u8; 4] = *b"PTGM";

/// The type of contract that can accept a governance instruction.
#[derive(
    BorshDeserialize,
    BorshSerialize,
    Clone,
    Copy,
    Debug,
    Deserialize,
    Eq,
    PartialEq,
    Serialize,
    num_derive::FromPrimitive,
    num_derive::ToPrimitive,
)]
#[borsh(crate = "near_sdk::borsh", use_discriminant = false)]
#[serde(crate = "near_sdk::serde")]
#[repr(u8)]
pub enum GovernanceModule {
    /// The PythNet executor contract
    Executor = 0,
    /// A target chain contract (like this one!)
    Target = 1,
}

/// A `GovernanceAction` represents the different actions that can be voted on and executed by the
/// governance system. Note that this implementation is NEAR specific, for example within the
/// UpgradeContract variant we use a codehash unlike a code_id in Cosmwasm, or a Pubkey in Solana.
///
/// [ref:chain_structure] This type uses a [u8; 32] for contract upgrades which differs from other
/// chains, see the reference for more details.
///
/// [ref:action_discriminants] The discriminants for this enum are duplicated into a separate enum
/// containing only the discriminants with no fields called `GovernanceActionId`. This allow for
/// type-safe matching IDs during deserialization. When new actions are added, this will force the
/// developer to update the parser.
#[derive(
    BorshDeserialize,
    BorshSerialize,
    Debug,
    Deserialize,
    EnumDiscriminants,
    Eq,
    PartialEq,
    Serialize,
)]
#[strum_discriminants(derive(num_derive::ToPrimitive, num_derive::FromPrimitive))]
#[strum_discriminants(name(GovernanceActionId))]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub enum GovernanceAction {
    UpgradeContract { codehash: [u8; 32] },
    AuthorizeGovernanceDataSourceTransfer { claim_vaa: Vec<u8> },
    SetDataSources { data_sources: Vec<Source> },
    SetFee { base: u64, expo: u64 },
    SetValidPeriod { valid_seconds: u64 },
    RequestGovernanceDataSourceTransfer { governance_data_source_index: u32 },
}

#[derive(BorshDeserialize, BorshSerialize, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct GovernanceInstruction {
    pub module: GovernanceModule,
    pub action: GovernanceAction,
    pub target: Chain,
}

impl GovernanceInstruction {
    /// Implements a `deserialize` method for the `GovernanceAction` enum using `nom` to
    /// deserialize the payload. The use of `nom` gives us parser safety, error handling, full
    /// buffer consumption, and a more readable implementation while staying efficient.
    pub fn deserialize(input: impl AsRef<[u8]>) -> Result<Self, Error> {
        use nom::{
            bytes::complete::take,
            combinator::all_consuming,
            multi::length_count,
            number::complete::{be_u16, be_u32, be_u64, be_u8},
        };

        let input = input.as_ref();

        // Verify Governance header is as expected so we can bail to avoid more parsing.
        let (input, magic) = take(4usize)(input)?;
        let (input, module) = be_u8(input)?;
        let (input, action) = be_u8(input)?;
        let (input, chain) = be_u16(input)?;
        let module = GovernanceModule::from_u8(module).ok_or(InvalidGovernanceModule)?;
        let chain = Chain::from(WormholeChain::from(chain));

        // Safely parse the action ID. [ref:action_discriminants]
        let action = GovernanceActionId::from_u8(action).ok_or(InvalidGovernanceAction)?;

        ensure!(magic == GOVERNANCE_MAGIC, InvalidGovernanceModule);
        ensure!(module == GovernanceModule::Target, InvalidGovernanceModule);

        Ok(GovernanceInstruction {
            module,
            target: chain,
            action: match action {
                GovernanceActionId::UpgradeContract => {
                    let (_input, bytes) = all_consuming(take(32usize))(input)?;
                    let mut codehash = [0u8; 32];
                    codehash.copy_from_slice(bytes);
                    GovernanceAction::UpgradeContract { codehash }
                }

                GovernanceActionId::AuthorizeGovernanceDataSourceTransfer => {
                    let (_input, claim_vaa) = all_consuming(take(input.len()))(input)?;
                    GovernanceAction::AuthorizeGovernanceDataSourceTransfer {
                        claim_vaa: claim_vaa.to_vec(),
                    }
                }

                GovernanceActionId::SetDataSources => {
                    let (_input, data_sources) = all_consuming(length_count(be_u8, |input| {
                        let (input, chain) = be_u16(input)?;
                        let (input, bytes) = take(32usize)(input)?;
                        let chain = Chain::from(WormholeChain::from(chain));
                        let mut emitter = [0u8; 32];
                        emitter.copy_from_slice(bytes);
                        Ok((input, Source { chain, emitter }))
                    }))(input)?;
                    GovernanceAction::SetDataSources { data_sources }
                }

                GovernanceActionId::SetFee => {
                    let (_input, (val, expo)) = all_consuming(|input| {
                        let (input, val) = be_u64(input)?;
                        let (input, expo) = be_u64(input)?;
                        Ok((input, (val, expo)))
                    })(input)?;
                    GovernanceAction::SetFee { base: val, expo }
                }

                GovernanceActionId::SetValidPeriod => {
                    let (_input, valid_seconds) = all_consuming(be_u64)(input)?;
                    GovernanceAction::SetValidPeriod { valid_seconds }
                }

                GovernanceActionId::RequestGovernanceDataSourceTransfer => {
                    let (_input, governance_data_source_index) = all_consuming(be_u32)(input)?;
                    GovernanceAction::RequestGovernanceDataSourceTransfer {
                        governance_data_source_index,
                    }
                }
            },
        })
    }

    /// Implements a `serialize` method for the `GovernanceAction` enum. The `nom` library doesn't
    /// provide serialization but serialization is a safer operation, so we can just use a simple
    /// push buffer to serialize.
    pub fn serialize(&self) -> Result<Vec<u8>, Error> {
        let mut buf = Vec::new();
        buf.extend_from_slice(&GOVERNANCE_MAGIC);
        buf.push(self.module as u8);

        match &self.action {
            GovernanceAction::UpgradeContract { codehash } => {
                buf.push(GovernanceActionId::UpgradeContract as u8);
                buf.extend_from_slice(&u16::from(self.target).to_be_bytes());
                buf.extend_from_slice(codehash);
            }

            GovernanceAction::AuthorizeGovernanceDataSourceTransfer { claim_vaa } => {
                buf.push(GovernanceActionId::AuthorizeGovernanceDataSourceTransfer as u8);
                buf.extend_from_slice(&u16::from(self.target).to_be_bytes());
                buf.extend_from_slice(claim_vaa);
            }

            GovernanceAction::SetDataSources { data_sources } => {
                buf.push(GovernanceActionId::SetDataSources as u8);
                buf.extend_from_slice(&u16::from(self.target).to_be_bytes());
                buf.push(u8::try_from(data_sources.len()).map_err(|_| InvalidPayload)?);
                for source in data_sources {
                    buf.extend_from_slice(&(u16::from(source.chain).to_be_bytes()));
                    buf.extend_from_slice(&source.emitter);
                }
            }

            GovernanceAction::SetFee { base: val, expo } => {
                buf.push(GovernanceActionId::SetFee as u8);
                buf.extend_from_slice(&u16::from(self.target).to_be_bytes());
                buf.extend_from_slice(&val.to_be_bytes());
                buf.extend_from_slice(&expo.to_be_bytes());
            }

            GovernanceAction::SetValidPeriod { valid_seconds } => {
                buf.push(GovernanceActionId::SetValidPeriod as u8);
                buf.extend_from_slice(&u16::from(self.target).to_be_bytes());
                buf.extend_from_slice(&valid_seconds.to_be_bytes());
            }

            GovernanceAction::RequestGovernanceDataSourceTransfer {
                governance_data_source_index,
            } => {
                buf.push(GovernanceActionId::RequestGovernanceDataSourceTransfer as u8);
                buf.extend_from_slice(&u16::from(self.target).to_be_bytes());
                buf.extend_from_slice(&governance_data_source_index.to_be_bytes());
            }
        }

        Ok(buf)
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
    pub fn execute_governance_instruction(&mut self, vaa: String) -> Result<Promise, Error> {
        // Verify the VAA is coming from a trusted source chain before attempting to verify VAA
        // signatures. Avoids a cross-contract call early.
        {
            let vaa = hex::decode(&vaa).map_err(|_| InvalidHex)?;
            let vaa: wormhole_sdk::Vaa<&RawMessage> =
                serde_wormhole::from_slice(&vaa).map_err(|_| InvalidVaa)?;

            // Convert to local VAA type to catch API changes.
            let vaa = Vaa::from(vaa);

            // Confirm the VAA is coming from a trusted source chain.
            ensure!(
                self.gov_source
                    == (Source {
                        emitter: vaa.emitter_address,
                        chain: vaa.emitter_chain,
                    }),
                UnknownSource(vaa.emitter_address)
            );
        }

        // Verify VAA and refund the caller in case of failure.
        Ok(ext_wormhole::ext(self.wormhole.clone())
            .with_static_gas(Gas::from_gas(30_000_000_000_000))
            .verify_vaa(vaa.clone())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_gas(10_000_000_000_000))
                    .with_attached_deposit(env::attached_deposit())
                    .verify_gov_vaa_callback(env::predecessor_account_id(), vaa),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_gas(10_000_000_000_000))
                    .refund_vaa(env::predecessor_account_id(), env::attached_deposit()),
            ))
    }

    /// Invoke handler upon successful verification of a VAA action.
    ///
    /// IMPORTANT: These functions should be idempotent otherwise NEAR's async model would allow
    /// for two VAA's to run in parallel before the sequence is updated. Another fix for this would
    /// be to pass the previous index and update during failure.
    #[payable]
    #[private]
    #[handle_result]
    pub fn verify_gov_vaa_callback(
        &mut self,
        account_id: AccountId,
        vaa: String,
        #[callback_result] _result: Result<u32, near_sdk::PromiseError>,
    ) -> Result<PromiseOrValue<()>, Error> {
        use GovernanceAction::*;

        ensure!(is_promise_success(), VaaVerificationFailed);

        // Get Storage Usage before execution.
        let storage = env::storage_usage();

        // Deserialize VAA, note that we already deserialized and verified the VAA in `process_vaa`
        // at this point so we only care about the `rest` component which contains bytes we can
        // deserialize into an Action.
        let vaa = hex::decode(vaa).map_err(|_| InvalidPayload)?;
        let vaa: wormhole_sdk::Vaa<&RawMessage> =
            serde_wormhole::from_slice(&vaa).map_err(|_| InvalidPayload)?;

        // Deserialize and verify the action is destined for this chain.
        let instruction = GovernanceInstruction::deserialize(vaa.payload)?;

        ensure!(
            instruction.target == Chain::from(WormholeChain::Near)
                || instruction.target == Chain::from(WormholeChain::Any),
            InvalidPayload
        );

        // Ensure the VAA is ahead in sequence, this check is here instead of during
        // `execute_governance_instruction` as otherwise someone would be able to slip
        // competing actions into the execution stream before the sequence is updated.
        ensure!(
            self.executed_governance_vaa < vaa.sequence,
            VaaVerificationFailed
        );

        self.executed_governance_vaa = vaa.sequence;

        match GovernanceInstruction::deserialize(vaa.payload)?.action {
            SetDataSources { data_sources } => self.set_sources(data_sources),
            SetFee { base, expo } => self.set_update_fee(base, expo)?,
            SetValidPeriod { valid_seconds } => self.set_valid_period(valid_seconds),
            RequestGovernanceDataSourceTransfer { .. } => Err(InvalidPayload)?,
            UpgradeContract { codehash } => {
                // Additionally restrict to only Near for upgrades. This is a safety measure to
                // prevent accidental upgrades to the wrong contract.
                ensure!(
                    instruction.target == Chain::from(WormholeChain::Near),
                    InvalidPayload
                );
                self.set_upgrade_hash(codehash)
            }

            // In the case of AuthorizeGovernanceDataSourceTransfer we need to verify the VAA
            // contained within the action. This implies another async call so we return here and
            // allow the refund / gov processing to happen in the callback.
            AuthorizeGovernanceDataSourceTransfer { claim_vaa } => {
                let claim_vaa = hex::encode(claim_vaa);

                // Return early, the callback has to perform the rest of the processing. Normally
                // VAA processing will complete and the code below this match statement will
                // execute. But because the VAA verification is async, we must return here instead
                // and the logic below is duplicated within the authorize_gov_source_transfer function.
                return Ok(PromiseOrValue::Promise(
                    ext_wormhole::ext(self.wormhole.clone())
                        .with_static_gas(Gas::from_gas(10_000_000_000_000))
                        .verify_vaa(claim_vaa.clone())
                        .then(
                            Self::ext(env::current_account_id())
                                .with_static_gas(Gas::from_gas(10_000_000_000_000))
                                .with_attached_deposit(env::attached_deposit())
                                .authorize_gov_source_transfer(
                                    env::predecessor_account_id(),
                                    claim_vaa,
                                    storage,
                                ),
                        )
                        .then(
                            Self::ext(env::current_account_id())
                                .with_static_gas(Gas::from_gas(10_000_000_000_000))
                                .refund_vaa(env::predecessor_account_id(), env::attached_deposit()),
                        ),
                ));
            }
        }

        // Refund storage difference to `account_id` after storage execution.
        Self::refund_storage_usage(
            account_id,
            storage,
            env::storage_usage(),
            env::attached_deposit(),
            None,
        )
        .map(|v| PromiseOrValue::Value(v))
    }

    /// If submitting an action fails then this callback will refund the caller.
    #[private]
    pub fn refund_vaa(&mut self, account_id: AccountId, amount: NearToken) {
        if !is_promise_success() {
            // No calculations needed as deposit size will have not changed. Can just refund the
            // whole deposit amount.
            Promise::new(account_id).transfer(amount);
        }
    }

    #[private]
    #[payable]
    #[handle_result]
    pub fn authorize_gov_source_transfer(
        &mut self,
        account_id: AccountId,
        claim_vaa: String,
        storage: u64,
        #[callback_result] _result: Result<u32, near_sdk::PromiseError>,
    ) -> Result<(), Error> {
        // If VAA verification failed we should bail.
        ensure!(is_promise_success(), VaaVerificationFailed);

        let vaa = hex::decode(claim_vaa).map_err(|_| InvalidPayload)?;
        let vaa: wormhole_sdk::Vaa<&RawMessage> =
            serde_wormhole::from_slice(&vaa).expect("Failed to deserialize VAA");

        // Convert to local VAA type to catch API changes.
        let vaa = Vaa::from(vaa);

        // Parse GovernanceInstruction from Payload.
        let instruction =
            GovernanceInstruction::deserialize(vaa.payload).expect("Failed to deserialize action");

        // Execute the embedded VAA action.
        match instruction.action {
            GovernanceAction::RequestGovernanceDataSourceTransfer {
                governance_data_source_index,
            } => {
                ensure!(
                    self.executed_governance_change_vaa < governance_data_source_index as u64,
                    Unknown
                );

                // Additionally restrict to only Near for Authorizations.
                ensure!(
                    instruction.target == Chain::from(WormholeChain::Near)
                        || instruction.target == Chain::from(WormholeChain::Any),
                    InvalidPayload
                );

                // Update executed VAA indices, prevents replay on both the VAA.
                self.executed_governance_change_vaa = governance_data_source_index as u64;
                self.executed_governance_vaa = vaa.sequence;

                // Update Governance Source
                self.gov_source = Source {
                    emitter: vaa.emitter_address,
                    chain: vaa.emitter_chain,
                };
            }

            _ => Err(Unknown)?,
        }

        // Refund storage difference to `account_id` after storage execution.
        Self::refund_storage_usage(
            account_id,
            storage,
            env::storage_usage(),
            env::attached_deposit(),
            None,
        )
    }

    /// This method allows self-upgrading the contract to a new implementation.
    ///
    /// This function is open to call by anyone, but to perform an authorized upgrade a VAA
    /// containing the hash of the `new_code` must have previously been relayed to this contract's
    /// `process_vaa` endpoint. otherwise the upgrade will fail.
    #[handle_result]
    pub fn update_contract(&mut self) -> Result<Promise, Error> {
        env::setup_panic_hook();
        let new_code = env::input().unwrap();
        self.upgrade(new_code)
    }

    fn upgrade(&mut self, new_code: Vec<u8>) -> Result<Promise, Error> {
        let signature = TryInto::<[u8; 32]>::try_into(env::sha256(&new_code)).unwrap();
        let default = <[u8; 32] as Default>::default();
        ensure!(signature != default, UnauthorizedUpgrade);
        ensure!(signature == self.codehash, UnauthorizedUpgrade);

        Ok(Promise::new(env::current_account_id())
            .deploy_contract(new_code)
            .then(Self::ext(env::current_account_id()).migrate())
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
        amount: NearToken,
        storage: u64,
    ) -> Result<(), Error> {
        Self::refund_storage_usage(account_id, storage, env::storage_usage(), amount, None)
    }
}

impl Pyth {
    #[allow(dead_code)]
    fn is_valid_governance_source(&self, source: &Source) -> Result<(), Error> {
        (self.gov_source == *source)
            .then_some(())
            .ok_or(UnknownSource(source.emitter))
    }

    pub fn set_valid_period(&mut self, threshold: u64) {
        self.stale_threshold = threshold;
    }

    pub fn set_update_fee(&mut self, fee: u64, expo: u64) -> Result<(), Error> {
        self.update_fee = NearToken::from_yoctonear(
            (fee as u128)
                .checked_mul(
                    10_u128
                        .checked_pow(u32::try_from(expo).map_err(|_| ArithmeticOverflow)?)
                        .ok_or(ArithmeticOverflow)?,
                )
                .ok_or(ArithmeticOverflow)?,
        );

        Ok(())
    }

    pub fn set_sources(&mut self, sources: Vec<Source>) {
        self.sources.clear();
        sources.iter().for_each(|s| {
            self.sources.insert(s);
        });
    }

    pub fn set_upgrade_hash(&mut self, codehash: [u8; 32]) {
        self.codehash = codehash;
    }
}

#[cfg(test)]
mod tests {
    use {
        super::*,
        crate::governance::GovernanceActionId,
        near_sdk::{
            test_utils::{accounts, VMContextBuilder},
            testing_env,
        },
        std::io::{Cursor, Write},
    };

    fn get_context() -> VMContextBuilder {
        let mut context = VMContextBuilder::new();
        context
            .current_account_id(accounts(0))
            .signer_account_id(accounts(0))
            .predecessor_account_id(accounts(0))
            .attached_deposit(NearToken::from_yoctonear(0))
            .is_view(false);
        context
    }

    #[test]
    fn test_upgrade() {
        let mut context = get_context();
        context.is_view(false);
        testing_env!(context.build());

        let mut contract = Pyth::new(
            "pyth.near".parse::<near_sdk::AccountId>().unwrap(),
            Source::default(),
            Source::default(),
            0.into(),
            32,
        );

        contract.codehash = env::sha256(&[1, 2, 3]).try_into().unwrap();
        contract.upgrade(vec![1, 2, 3]).expect("Upgrade failed");
    }

    #[test]
    #[should_panic(expected = "UnauthorizedUpgrade")]
    fn test_upgrade_fail() {
        let mut context = get_context();
        context.is_view(false);
        testing_env!(context.build());

        let mut contract = Pyth::new(
            "pyth.near".parse::<near_sdk::AccountId>().unwrap(),
            Source::default(),
            Source::default(),
            0.into(),
            32,
        );

        contract.codehash = env::sha256(&[1, 2, 3]).try_into().unwrap();
        contract.upgrade(vec![1, 2, 3, 4]).expect("Upgrade failed");
    }

    #[test]
    fn test_set_valid_period() {
        let mut context = get_context();
        context.is_view(false);
        testing_env!(context.build());

        let mut contract = Pyth::new(
            "pyth.near".parse::<near_sdk::AccountId>().unwrap(),
            Source::default(),
            Source::default(),
            0.into(),
            32,
        );

        contract.set_valid_period(100);
        assert_eq!(contract.stale_threshold, 100);
    }

    #[test]
    fn test_set_update_fee() {
        let mut context = get_context();
        context.is_view(false);
        testing_env!(context.build());

        let mut contract = Pyth::new(
            "pyth.near".parse::<near_sdk::AccountId>().unwrap(),
            Source::default(),
            Source::default(),
            0.into(),
            32,
        );

        contract.set_update_fee(100, 2).expect("Failed to set fee");
        assert_eq!(contract.update_fee, NearToken::from_yoctonear(10000));
    }

    #[test]
    fn test_governance_serialize_matches_deserialize() {
        // We match on the GovernanceActionId so that when new variants are added the test is
        // forced to be updated. There's nothing special about SetFee we just need a concrete value
        // to match on.
        match GovernanceActionId::SetFee {
            GovernanceActionId::SetValidPeriod => {
                let instruction = GovernanceInstruction {
                    module: GovernanceModule::Target,
                    target: Chain::from(WormholeChain::Near),
                    action: GovernanceAction::SetValidPeriod { valid_seconds: 100 },
                };

                assert_eq!(
                    instruction,
                    GovernanceInstruction::deserialize(instruction.serialize().unwrap()).unwrap()
                );
            }

            GovernanceActionId::SetDataSources => {
                let instruction = GovernanceInstruction {
                    module: GovernanceModule::Target,
                    target: Chain::from(WormholeChain::Near),
                    action: GovernanceAction::SetDataSources {
                        data_sources: vec![Source::default()],
                    },
                };

                assert_eq!(
                    instruction,
                    GovernanceInstruction::deserialize(instruction.serialize().unwrap()).unwrap()
                );
            }

            GovernanceActionId::SetFee => {
                let instruction = GovernanceInstruction {
                    module: GovernanceModule::Target,
                    target: Chain::from(WormholeChain::Near),
                    action: GovernanceAction::SetFee {
                        base: 100,
                        expo: 100,
                    },
                };

                assert_eq!(
                    instruction,
                    GovernanceInstruction::deserialize(instruction.serialize().unwrap()).unwrap()
                );
            }

            GovernanceActionId::UpgradeContract => {
                let instruction = GovernanceInstruction {
                    module: GovernanceModule::Target,
                    target: Chain::from(WormholeChain::Near),
                    action: GovernanceAction::UpgradeContract { codehash: [1; 32] },
                };

                assert_eq!(
                    instruction,
                    GovernanceInstruction::deserialize(instruction.serialize().unwrap()).unwrap()
                );
            }

            GovernanceActionId::AuthorizeGovernanceDataSourceTransfer => {
                let vaa = {
                    let vaa = wormhole_sdk::Vaa {
                        emitter_chain: wormhole_sdk::Chain::Any,
                        emitter_address: wormhole_sdk::Address([0; 32]),
                        sequence: 1,
                        payload: (),
                        ..Default::default()
                    };

                    let mut cur = Cursor::new(Vec::new());
                    serde_wormhole::to_writer(&mut cur, &vaa).expect("Failed to serialize VAA");
                    cur.write_all(
                        &GovernanceInstruction {
                            target: Chain::from(WormholeChain::Near),
                            module: GovernanceModule::Target,
                            action: GovernanceAction::RequestGovernanceDataSourceTransfer {
                                governance_data_source_index: 1,
                            },
                        }
                        .serialize()
                        .unwrap(),
                    )
                    .expect("Failed to write Payload");
                    cur.into_inner()
                };

                let instruction = GovernanceInstruction {
                    module: GovernanceModule::Target,
                    target: Chain::from(WormholeChain::Near),
                    action: GovernanceAction::AuthorizeGovernanceDataSourceTransfer {
                        claim_vaa: vaa,
                    },
                };

                assert_eq!(
                    instruction,
                    GovernanceInstruction::deserialize(instruction.serialize().unwrap()).unwrap()
                );
            }

            GovernanceActionId::RequestGovernanceDataSourceTransfer => {
                unimplemented!()
            }
        }
    }
}
