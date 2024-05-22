mod errors;
mod interface;
mod price_update;
mod governance;

pub use pyth::{Event, PriceFeedUpdateEvent, WormholeAddressSet, GovernanceDataSourceSet};
pub use errors::{GetPriceUnsafeError, GovernanceActionError, UpdatePriceFeedsError};
pub use interface::{IPyth, IPythDispatcher, IPythDispatcherTrait, DataSource, Price};

#[starknet::contract]
mod pyth {
    use super::price_update::{
        PriceInfo, PriceFeedMessage, read_and_verify_message, read_header_and_wormhole_proof,
        parse_wormhole_proof
    };
    use pyth::reader::{Reader, ReaderImpl};
    use pyth::byte_array::{ByteArray, ByteArrayImpl};
    use core::panic_with_felt252;
    use core::starknet::{ContractAddress, get_caller_address, get_execution_info};
    use pyth::wormhole::{IWormholeDispatcher, IWormholeDispatcherTrait, VerifiedVM};
    use super::{
        DataSource, UpdatePriceFeedsError, GovernanceActionError, Price, GetPriceUnsafeError
    };
    use super::governance;
    use super::governance::GovernancePayload;
    use openzeppelin::token::erc20::interface::{IERC20CamelDispatcherTrait, IERC20CamelDispatcher};

    #[event]
    #[derive(Drop, PartialEq, starknet::Event)]
    pub enum Event {
        PriceFeedUpdate: PriceFeedUpdateEvent,
        WormholeAddressSet: WormholeAddressSet,
        GovernanceDataSourceSet: GovernanceDataSourceSet,
    }

    #[derive(Drop, PartialEq, starknet::Event)]
    pub struct PriceFeedUpdateEvent {
        #[key]
        pub price_id: u256,
        pub publish_time: u64,
        pub price: i64,
        pub conf: u64,
    }

    #[derive(Drop, PartialEq, starknet::Event)]
    pub struct WormholeAddressSet {
        pub old_address: ContractAddress,
        pub new_address: ContractAddress,
    }

    #[derive(Drop, PartialEq, starknet::Event)]
    pub struct GovernanceDataSourceSet {
        pub old_data_source: DataSource,
        pub new_data_source: DataSource,
        pub last_executed_governance_sequence: u64,
    }

    #[storage]
    struct Storage {
        wormhole_address: ContractAddress,
        fee_contract_address: ContractAddress,
        single_update_fee: u256,
        owner: ContractAddress,
        data_sources: LegacyMap<usize, DataSource>,
        num_data_sources: usize,
        // For fast validation.
        is_valid_data_source: LegacyMap<DataSource, bool>,
        latest_price_info: LegacyMap<u256, PriceInfo>,
        governance_data_source: DataSource,
        last_executed_governance_sequence: u64,
        // Governance data source index is used to prevent replay attacks,
        // so a claimVaa cannot be used twice.
        governance_data_source_index: u32,
    }

    /// Initializes the Pyth contract.
    ///
    /// `owner` is the address that will be allowed to call governance methods (it's a placeholder
    /// until we implement governance properly).
    ///
    /// `wormhole_address` is the address of the deployed Wormhole contract implemented in the `wormhole` module.
    ///
    /// `fee_contract_address` is the address of the ERC20 token used to pay fees to Pyth
    /// for price updates. There is no native token on Starknet so an ERC20 contract has to be used.
    /// On Katana, an ETH fee contract is pre-deployed. On Starknet testnet, ETH and STRK fee tokens are
    /// available. Any other ERC20-compatible token can also be used.
    /// In a Starknet Forge testing environment, a fee contract must be deployed manually.
    ///
    /// `single_update_fee` is the number of tokens of `fee_contract_address` charged for a single price update.
    ///
    /// `data_sources` is the list of Wormhole data sources accepted by this contract.
    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        wormhole_address: ContractAddress,
        fee_contract_address: ContractAddress,
        single_update_fee: u256,
        data_sources: Array<DataSource>,
        governance_emitter_chain_id: u16,
        governance_emitter_address: u256,
        governance_initial_sequence: u64,
    ) {
        self.owner.write(wormhole_address);
        self.wormhole_address.write(wormhole_address);
        self.fee_contract_address.write(fee_contract_address);
        self.single_update_fee.write(single_update_fee);
        self.write_data_sources(data_sources);
        self
            .governance_data_source
            .write(
                DataSource {
                    emitter_chain_id: governance_emitter_chain_id,
                    emitter_address: governance_emitter_address,
                }
            );
        self.last_executed_governance_sequence.write(governance_initial_sequence);
    }

    #[abi(embed_v0)]
    impl PythImpl of super::IPyth<ContractState> {
        fn get_price_unsafe(
            self: @ContractState, price_id: u256
        ) -> Result<Price, GetPriceUnsafeError> {
            let info = self.latest_price_info.read(price_id);
            if info.publish_time == 0 {
                return Result::Err(GetPriceUnsafeError::PriceFeedNotFound);
            }
            let price = Price {
                price: info.price,
                conf: info.conf,
                expo: info.expo,
                publish_time: info.publish_time,
            };
            Result::Ok(price)
        }

        fn get_ema_price_unsafe(
            self: @ContractState, price_id: u256
        ) -> Result<Price, GetPriceUnsafeError> {
            let info = self.latest_price_info.read(price_id);
            if info.publish_time == 0 {
                return Result::Err(GetPriceUnsafeError::PriceFeedNotFound);
            }
            let price = Price {
                price: info.ema_price,
                conf: info.ema_conf,
                expo: info.expo,
                publish_time: info.publish_time,
            };
            Result::Ok(price)
        }

        fn set_data_sources(ref self: ContractState, sources: Array<DataSource>) {
            if self.owner.read() != get_caller_address() {
                panic_with_felt252(GovernanceActionError::AccessDenied.into());
            }
            self.write_data_sources(sources);
        }

        fn set_fee(ref self: ContractState, single_update_fee: u256) {
            if self.owner.read() != get_caller_address() {
                panic_with_felt252(GovernanceActionError::AccessDenied.into());
            }
            self.single_update_fee.write(single_update_fee);
        }

        fn update_price_feeds(ref self: ContractState, data: ByteArray) {
            let mut reader = ReaderImpl::new(data);
            let wormhole_proof = read_header_and_wormhole_proof(ref reader);
            let wormhole = IWormholeDispatcher { contract_address: self.wormhole_address.read() };
            let vm = wormhole.parse_and_verify_vm(wormhole_proof);

            let source = DataSource {
                emitter_chain_id: vm.emitter_chain_id, emitter_address: vm.emitter_address
            };
            if !self.is_valid_data_source.read(source) {
                panic_with_felt252(UpdatePriceFeedsError::InvalidUpdateDataSource.into());
            }

            let root_digest = parse_wormhole_proof(vm.payload);

            let num_updates = reader.read_u8();
            let total_fee = self.get_total_fee(num_updates);
            let fee_contract = IERC20CamelDispatcher {
                contract_address: self.fee_contract_address.read()
            };
            let execution_info = get_execution_info().unbox();
            let caller = execution_info.caller_address;
            let contract = execution_info.contract_address;
            if fee_contract.allowance(caller, contract) < total_fee {
                panic_with_felt252(UpdatePriceFeedsError::InsufficientFeeAllowance.into());
            }
            if !fee_contract.transferFrom(caller, contract, total_fee) {
                panic_with_felt252(UpdatePriceFeedsError::InsufficientFeeAllowance.into());
            }

            let mut i = 0;
            while i < num_updates {
                let message = read_and_verify_message(ref reader, root_digest);
                self.update_latest_price_if_necessary(message);
                i += 1;
            };

            if reader.len() != 0 {
                panic_with_felt252(UpdatePriceFeedsError::InvalidUpdateData.into());
            }
        }

        fn execute_governance_instruction(ref self: ContractState, data: ByteArray) {
            let wormhole = IWormholeDispatcher { contract_address: self.wormhole_address.read() };
            let vm = wormhole.parse_and_verify_vm(data.clone());
            self.verify_governance_vm(@vm);
            let instruction = governance::parse_instruction(vm.payload);
            if instruction.target_chain_id != 0
                && instruction.target_chain_id != wormhole.chain_id() {
                panic_with_felt252(GovernanceActionError::InvalidGovernanceTarget.into());
            }
            match instruction.payload {
                GovernancePayload::SetFee(payload) => {
                    let value = apply_decimal_expo(payload.value, payload.expo);
                    self.single_update_fee.write(value);
                },
                GovernancePayload::SetDataSources(payload) => {
                    self.write_data_sources(payload.sources);
                },
                GovernancePayload::SetWormholeAddress(payload) => {
                    if instruction.target_chain_id == 0 {
                        panic_with_felt252(GovernanceActionError::InvalidGovernanceTarget.into());
                    }
                    self.check_new_wormhole(payload.address, data);
                    self.wormhole_address.write(payload.address);
                    let event = WormholeAddressSet {
                        old_address: wormhole.contract_address, new_address: payload.address,
                    };
                    self.emit(event);
                },
                GovernancePayload::RequestGovernanceDataSourceTransfer(_) => {
                    // RequestGovernanceDataSourceTransfer can be only part of
                    // AuthorizeGovernanceDataSourceTransfer message
                    panic_with_felt252(GovernanceActionError::InvalidGovernanceMessage.into());
                },
                GovernancePayload::AuthorizeGovernanceDataSourceTransfer(payload) => {
                    self.authorize_governance_transfer(payload.claim_vaa);
                },
            }
        }
    }

    #[generate_trait]
    impl PrivateImpl of PrivateTrait {
        fn write_data_sources(ref self: ContractState, data_sources: Array<DataSource>) {
            let num_old = self.num_data_sources.read();
            let mut i = 0;
            while i < num_old {
                let old_source = self.data_sources.read(i);
                self.is_valid_data_source.write(old_source, false);
                self.data_sources.write(i, Default::default());
                i += 1;
            };

            self.num_data_sources.write(data_sources.len());
            i = 0;
            while i < data_sources.len() {
                let source = data_sources.at(i);
                self.is_valid_data_source.write(*source, true);
                self.data_sources.write(i, *source);
                i += 1;
            };
        }

        fn update_latest_price_if_necessary(ref self: ContractState, message: PriceFeedMessage) {
            let latest_publish_time = self.latest_price_info.read(message.price_id).publish_time;
            if message.publish_time > latest_publish_time {
                let info = PriceInfo {
                    price: message.price,
                    conf: message.conf,
                    expo: message.expo,
                    publish_time: message.publish_time,
                    ema_price: message.ema_price,
                    ema_conf: message.ema_conf,
                };
                self.latest_price_info.write(message.price_id, info);

                let event = PriceFeedUpdateEvent {
                    price_id: message.price_id,
                    publish_time: message.publish_time,
                    price: message.price,
                    conf: message.conf,
                };
                self.emit(event);
            }
        }

        fn get_total_fee(ref self: ContractState, num_updates: u8) -> u256 {
            self.single_update_fee.read() * num_updates.into()
        }

        fn verify_governance_vm(ref self: ContractState, vm: @VerifiedVM) {
            let governance_data_source = self.governance_data_source.read();
            if governance_data_source.emitter_chain_id != *vm.emitter_chain_id {
                panic_with_felt252(GovernanceActionError::InvalidGovernanceDataSource.into());
            }
            if governance_data_source.emitter_address != *vm.emitter_address {
                panic_with_felt252(GovernanceActionError::InvalidGovernanceDataSource.into());
            }
            if *vm.sequence <= self.last_executed_governance_sequence.read() {
                panic_with_felt252(GovernanceActionError::OldGovernanceMessage.into());
            }
            // Note: in case of AuthorizeGovernanceDataSourceTransfer,
            // last_executed_governance_sequence is later overwritten with the value from claim_vaa
            self.last_executed_governance_sequence.write(*vm.sequence);
        }

        fn check_new_wormhole(
            ref self: ContractState, wormhole_address: ContractAddress, vm: ByteArray
        ) {
            let wormhole = IWormholeDispatcher { contract_address: wormhole_address };
            let vm = wormhole.parse_and_verify_vm(vm);

            let governance_data_source = self.governance_data_source.read();
            if governance_data_source.emitter_chain_id != vm.emitter_chain_id {
                panic_with_felt252(GovernanceActionError::InvalidGovernanceDataSource.into());
            }
            if governance_data_source.emitter_address != vm.emitter_address {
                panic_with_felt252(GovernanceActionError::InvalidGovernanceDataSource.into());
            }

            if vm.sequence != self.last_executed_governance_sequence.read() {
                panic_with_felt252(GovernanceActionError::InvalidWormholeAddressToSet.into());
            }
            // Purposefully, we don't check whether the chainId is the same as the current chainId because
            // we might want to change the chain id of the wormhole contract.
            let data = governance::parse_instruction(vm.payload);
            match data.payload {
                GovernancePayload::SetWormholeAddress(payload) => {
                    // The following check is not necessary for security, but is a sanity check that the new wormhole
                    // contract parses the payload correctly.
                    if payload.address != wormhole_address {
                        panic_with_felt252(
                            GovernanceActionError::InvalidWormholeAddressToSet.into()
                        );
                    }
                },
                _ => {
                    panic_with_felt252(GovernanceActionError::InvalidWormholeAddressToSet.into());
                }
            }
        }

        fn authorize_governance_transfer(ref self: ContractState, claim_vaa: ByteArray) {
            let wormhole = IWormholeDispatcher { contract_address: self.wormhole_address.read() };
            let claim_vm = wormhole.parse_and_verify_vm(claim_vaa.clone());
            // Note: no verify_governance_vm() because claim_vaa is signed by the new data source
            let instruction = governance::parse_instruction(claim_vm.payload);
            if instruction.target_chain_id != 0
                && instruction.target_chain_id != wormhole.chain_id() {
                panic_with_felt252(GovernanceActionError::InvalidGovernanceTarget.into());
            }
            let request_payload = match instruction.payload {
                GovernancePayload::RequestGovernanceDataSourceTransfer(payload) => payload,
                _ => { panic_with_felt252(GovernanceActionError::InvalidGovernanceMessage.into()) }
            };
            // Governance data source index is used to prevent replay attacks,
            // so a claimVaa cannot be used twice.
            let current_index = self.governance_data_source_index.read();
            let new_index = request_payload.governance_data_source_index;
            if current_index >= new_index {
                panic_with_felt252(GovernanceActionError::OldGovernanceMessage.into());
            }
            self.governance_data_source_index.write(request_payload.governance_data_source_index);
            let old_data_source = self.governance_data_source.read();
            let new_data_source = DataSource {
                emitter_chain_id: claim_vm.emitter_chain_id,
                emitter_address: claim_vm.emitter_address,
            };
            self.governance_data_source.write(new_data_source);
            // Setting the last executed governance to the claimVaa sequence to avoid
            // using older sequences.
            let last_executed_governance_sequence = claim_vm.sequence;
            self.last_executed_governance_sequence.write(last_executed_governance_sequence);

            let event = GovernanceDataSourceSet {
                old_data_source, new_data_source, last_executed_governance_sequence,
            };
            self.emit(event);
        }
    }

    fn apply_decimal_expo(value: u64, expo: u64) -> u256 {
        let mut output: u256 = value.into();
        let mut i = 0;
        while i < expo {
            output *= 10;
            i += 1;
        };
        output
    }
}
