use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{Address, FixedBytes, U16, U256, U32, U64},
    call::Call,
    prelude::*,
};

use crate::{
    error::PythReceiverError,
    governance_structs::{self, *},
    structs::DataSource,
    IWormholeContract, PythReceiver,
};
use wormhole_vaas::{Readable, Vaa, Writeable};

impl PythReceiver {
    pub fn execute_governance_instruction_internal(
        &mut self,
        data: Vec<u8>,
    ) -> Result<(), PythReceiverError> {
        let wormhole: IWormholeContract = IWormholeContract::new(self.wormhole.get());
        let config = Call::new();

        wormhole
            .parse_and_verify_vm(config, Vec::from(data.clone()))
            .map_err(|_| PythReceiverError::InvalidWormholeMessage)?;

        let vm = Vaa::read(&mut Vec::from(data.clone()).as_slice())
            .map_err(|_| PythReceiverError::InvalidVaa)?;

        verify_governance_vm(self, vm.clone())?;

        let instruction = governance_structs::parse_instruction(vm.body.payload.to_vec())
            .map_err(|_| PythReceiverError::InvalidGovernanceMessage)?;

        let chain_id_config = Call::new();

        let wormhole_id = wormhole
            .chain_id(chain_id_config)
            .map_err(|_| PythReceiverError::WormholeUninitialized)?;

        if instruction.target_chain_id != 0 && instruction.target_chain_id != wormhole_id {
            return Err(PythReceiverError::InvalidGovernanceTarget);
        }

        match instruction.payload {
            GovernancePayload::SetFee(payload) => {
                self.set_fee(payload.value, payload.expo);
            }
            GovernancePayload::SetDataSources(payload) => {
                set_data_sources(self, payload.sources);
            }
            GovernancePayload::SetWormholeAddress(payload) => {
                self.set_wormhole_address(payload.address, data.clone())?;
            }
            GovernancePayload::RequestGovernanceDataSourceTransfer(_) => {
                return Err(PythReceiverError::InvalidGovernanceMessage);
            }
            GovernancePayload::AuthorizeGovernanceDataSourceTransfer(payload) => {
                self.authorize_governance_transfer(payload.claim_vaa)?;
            }
            GovernancePayload::UpgradeContract(_payload) => {}
            GovernancePayload::SetValidPeriod(payload) => {
                self.set_valid_period(payload.valid_time_period_seconds);
            }
            GovernancePayload::SetTransactionFee(payload) => {
                self.set_transaction_fee(payload.value, payload.expo);
            }
            GovernancePayload::WithdrawFee(payload) => {
                self.withdraw_fee(payload.value, payload.expo, payload.target_address)?;
            }
        }

        Ok(())
    }

    fn upgrade_contract(&self, _new_implementation: FixedBytes<32>) {
        unimplemented!("Upgrade contract not yet implemented");
    }

    fn set_fee(&mut self, value: u64, expo: u64) {
        let new_fee = U256::from(value).saturating_mul(U256::from(10).pow(U256::from(expo)));
        let old_fee = self.single_update_fee_in_wei.get();

        self.single_update_fee_in_wei.set(new_fee);

        log(self.vm(), crate::FeeSet { old_fee, new_fee });
    }

    fn set_valid_period(&mut self, valid_time_period_seconds: u64) {
        let old_valid_period = self.valid_time_period_seconds.get();
        let new_valid_period = U256::from(valid_time_period_seconds);
        self.valid_time_period_seconds.set(new_valid_period);

        log(
            self.vm(),
            crate::ValidPeriodSet {
                old_valid_period,
                new_valid_period,
            },
        );
    }

    fn set_wormhole_address(
        &mut self,
        address: Address,
        data: Vec<u8>,
    ) -> Result<(), PythReceiverError> {
        let wormhole: IWormholeContract = IWormholeContract::new(address);
        let config = Call::new();

        wormhole
            .parse_and_verify_vm(config, data.clone())
            .map_err(|_| PythReceiverError::InvalidVaa)?;

        let vm = Vaa::read(&mut data.as_slice())
            .map_err(|_| PythReceiverError::VaaVerificationFailed)?;

        if vm.body.emitter_chain != self.governance_data_source_chain_id.get().to::<u16>() {
            return Err(PythReceiverError::InvalidGovernanceMessage);
        }

        if vm.body.emitter_address.as_slice()
            != self.governance_data_source_emitter_address.get().as_slice()
        {
            return Err(PythReceiverError::InvalidGovernanceMessage);
        }

        if vm.body.sequence.to::<u64>() <= self.last_executed_governance_sequence.get().to::<u64>()
        {
            return Err(PythReceiverError::InvalidWormholeAddressToSet);
        }

        let data = governance_structs::parse_instruction(vm.body.payload.to_vec())
            .map_err(|_| PythReceiverError::InvalidGovernanceMessage)?;

        match data.payload {
            GovernancePayload::SetWormholeAddress(payload) => {
                if payload.address != address {
                    return Err(PythReceiverError::InvalidWormholeAddressToSet);
                }
            }
            _ => return Err(PythReceiverError::InvalidGovernanceMessage),
        }

        self.wormhole.set(address);
        Ok(())
    }

    fn authorize_governance_transfer(
        &mut self,
        claim_vaa: Vec<u8>,
    ) -> Result<(), PythReceiverError> {
        let wormhole: IWormholeContract = IWormholeContract::new(self.wormhole.get());
        let config = Call::new();
        wormhole
            .parse_and_verify_vm(config, claim_vaa.clone())
            .map_err(|_| PythReceiverError::InvalidWormholeMessage)?;

        let claim_vm = Vaa::read(&mut Vec::from(claim_vaa).as_slice())
            .map_err(|_| PythReceiverError::VaaVerificationFailed)?;

        let instruction = governance_structs::parse_instruction(claim_vm.body.payload.to_vec())
            .map_err(|_| PythReceiverError::InvalidGovernanceMessage)?;

        let config2 = Call::new();
        if instruction.target_chain_id != 0
            && instruction.target_chain_id != wormhole.chain_id(config2).unwrap_or(0)
        {
            return Err(PythReceiverError::InvalidGovernanceTarget);
        }

        let request_payload = match instruction.payload {
            GovernancePayload::RequestGovernanceDataSourceTransfer(payload) => payload,
            _ => return Err(PythReceiverError::InvalidGovernanceMessage),
        };

        let current_index = self.governance_data_source_index.get().to::<u32>();
        let new_index = request_payload.governance_data_source_index;

        if current_index >= new_index {
            return Err(PythReceiverError::OldGovernanceMessage);
        }

        self.governance_data_source_index.set(U32::from(new_index));
        let old_data_source_emitter_address = self.governance_data_source_emitter_address.get();

        self.governance_data_source_chain_id
            .set(U16::from(claim_vm.body.emitter_chain));
        let emitter_bytes: [u8; 32] = claim_vm
            .body
            .emitter_address
            .as_slice()
            .try_into()
            .map_err(|_| PythReceiverError::InvalidEmitterAddress)?;
        self.governance_data_source_emitter_address
            .set(FixedBytes::from(emitter_bytes));

        let last_executed_governance_sequence = claim_vm.body.sequence.to::<u64>();
        self.last_executed_governance_sequence
            .set(U64::from(last_executed_governance_sequence));

        log(
            self.vm(),
            crate::GovernanceDataSourceSet {
                old_chain_id: current_index as u16,
                old_emitter_address: old_data_source_emitter_address,
                new_chain_id: claim_vm.body.emitter_chain,
                new_emitter_address: FixedBytes::from(emitter_bytes),
                initial_sequence: last_executed_governance_sequence,
            },
        );

        Ok(())
    }

    fn set_transaction_fee(&mut self, value: u64, expo: u64) {
        let new_fee = U256::from(value).saturating_mul(U256::from(10).pow(U256::from(expo)));
        let old_fee = self.transaction_fee_in_wei.get();

        self.transaction_fee_in_wei.set(new_fee);

        log(self.vm(), crate::TransactionFeeSet { old_fee, new_fee });
    }

    fn withdraw_fee(
        &mut self,
        value: u64,
        expo: u64,
        target_address: Address,
    ) -> Result<(), PythReceiverError> {
        let fee_to_withdraw =
            U256::from(value).saturating_mul(U256::from(10).pow(U256::from(expo)));
        let current_balance = self.vm().balance(self.vm().contract_address());

        if current_balance < fee_to_withdraw {
            return Err(PythReceiverError::InsufficientFee);
        }

        self.vm()
            .transfer_eth(target_address, fee_to_withdraw)
            .map_err(|_| PythReceiverError::InsufficientFee)?;

        log(
            self.vm(),
            crate::FeeWithdrawn {
                target_address,
                fee_amount: fee_to_withdraw,
            },
        );

        Ok(())
    }
}

pub fn verify_governance_vm(receiver: &mut PythReceiver, vm: Vaa) -> Result<(), PythReceiverError> {
    if vm.body.emitter_chain != receiver.governance_data_source_chain_id.get().to::<u16>() {
        return Err(PythReceiverError::InvalidGovernanceMessage);
    }

    if vm.body.emitter_address.as_slice()
        != receiver
            .governance_data_source_emitter_address
            .get()
            .as_slice()
    {
        return Err(PythReceiverError::InvalidGovernanceMessage);
    }

    let current_sequence = vm.body.sequence.to::<u64>();
    let last_executed_sequence = receiver.last_executed_governance_sequence.get().to::<u64>();

    if current_sequence <= last_executed_sequence {
        return Err(PythReceiverError::GovernanceMessageAlreadyExecuted);
    }

    receiver
        .last_executed_governance_sequence
        .set(U64::from(current_sequence));

    Ok(())
}

pub fn set_data_sources(receiver: &mut PythReceiver, data_sources: Vec<DataSource>) {
    let mut old_data_sources = Vec::new();
    for i in 0..receiver.valid_data_sources.len() {
        if let Some(storage_data_source) = receiver.valid_data_sources.get(i) {
            let data_source = DataSource {
                chain_id: storage_data_source.chain_id.get(),
                emitter_address: storage_data_source.emitter_address.get(),
            };
            old_data_sources.push(data_source.emitter_address);
            receiver.is_valid_data_source.setter(data_source).set(false);
        }
    }

    receiver.valid_data_sources.erase();

    let mut new_data_sources = Vec::new();
    for data_source in data_sources {
        let mut storage_data_source = receiver.valid_data_sources.grow();
        storage_data_source.chain_id.set(data_source.chain_id);
        storage_data_source
            .emitter_address
            .set(data_source.emitter_address);

        new_data_sources.push(data_source.emitter_address);
        receiver.is_valid_data_source.setter(data_source).set(true);
    }

    log(
        receiver.vm(),
        crate::DataSourcesSet {
            old_data_sources,
            new_data_sources,
        },
    );
}
