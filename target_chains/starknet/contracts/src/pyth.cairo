mod errors;

mod fake_upgrades;
pub mod governance;
mod interface;
mod price_update;
pub use errors::{
    GetPriceNoOlderThanError, GetPriceUnsafeError, GetSingleUpdateFeeError, GovernanceActionError,
    ParsePriceFeedsError, UpdatePriceFeedsError, UpdatePriceFeedsIfNecessaryError,
};
pub use interface::{
    DataSource, GetDataSource, IPyth, IPythDispatcher, IPythDispatcherTrait, Price, PriceFeed,
    PriceFeedPublishTime,
};

pub use pyth::{
    ContractUpgraded, DataSourcesSet, Event, FeeSet, GovernanceDataSourceSet, PriceFeedUpdated,
    WormholeAddressSet,
};

#[starknet::contract]
mod pyth {
    use core::dict::Felt252Dict;
    use core::fmt::{Debug, Formatter};
    use core::nullable::{FromNullableResult, NullableTrait, match_nullable};
    use core::panic_with_felt252;
    use openzeppelin::token::erc20::interface::{IERC20CamelDispatcher, IERC20CamelDispatcherTrait};
    use pyth::byte_buffer::{ByteBuffer, ByteBufferImpl};
    use pyth::pyth::interface::IPyth;
    use pyth::reader::ReaderImpl;
    use pyth::util::{ResultMapErrInto, write_i64};
    use pyth::wormhole::{IWormholeDispatcher, IWormholeDispatcherTrait, VerifiedVM};
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::syscalls::replace_class_syscall;
    use starknet::{
        ClassHash, ContractAddress, SyscallResultTrait, get_block_timestamp, get_contract_address,
        get_execution_info,
    };
    use super::price_update::{
        PriceFeedMessage, PriceInfo, parse_wormhole_proof, read_and_verify_header,
        read_and_verify_message,
    };
    use super::governance::GovernancePayload;
    use super::{
        DataSource, GetDataSource, GetPriceNoOlderThanError, GetPriceUnsafeError,
        GetSingleUpdateFeeError, GovernanceActionError, IPythDispatcher, IPythDispatcherTrait,
        ParsePriceFeedsError, Price, PriceFeed, PriceFeedPublishTime, UpdatePriceFeedsError,
        UpdatePriceFeedsIfNecessaryError, governance,
    };

    #[event]
    #[derive(Drop, Clone, Debug, PartialEq, Serde, starknet::Event)]
    pub enum Event {
        PriceFeedUpdated: PriceFeedUpdated,
        FeeSet: FeeSet,
        DataSourcesSet: DataSourcesSet,
        WormholeAddressSet: WormholeAddressSet,
        GovernanceDataSourceSet: GovernanceDataSourceSet,
        ContractUpgraded: ContractUpgraded,
    }

    #[derive(Drop, Clone, PartialEq, Serde, starknet::Event)]
    pub struct PriceFeedUpdated {
        #[key]
        pub price_id: u256,
        pub price: i64,
        pub conf: u64,
        pub publish_time: u64,
    }

    // TODO: use derives after upgrading cairo
    impl DebugPriceFeedUpdated of Debug<PriceFeedUpdated> {
        fn fmt(self: @PriceFeedUpdated, ref f: Formatter) -> Result<(), core::fmt::Error> {
            write!(f, "PriceFeedUpdated {{ price_id: {}, price: ", self.price_id)?;
            write_i64(ref f, *self.price)?;
            write!(f, ", conf: {}, publish_time: {} }}", self.conf, self.publish_time)
        }
    }

    #[cfg(test)]
    #[test]
    fn test_debug_price_feed_updated() {
        let value = PriceFeedUpdated { price_id: 1, price: 2, conf: 3, publish_time: 5 };
        let expected = "PriceFeedUpdated { price_id: 1, price: 2, conf: 3, publish_time: 5 }";
        let actual = format!("{:?}", value);
        assert!(actual == expected);
    }


    #[derive(Drop, Clone, Debug, PartialEq, Serde, starknet::Event)]
    pub struct FeeSet {
        pub old_fee: u256,
        pub new_fee: u256,
        pub token: ContractAddress,
    }

    #[derive(Drop, Clone, Debug, PartialEq, Serde, starknet::Event)]
    pub struct DataSourcesSet {
        pub old_data_sources: Array<DataSource>,
        pub new_data_sources: Array<DataSource>,
    }

    #[derive(Drop, Clone, Debug, PartialEq, Serde, starknet::Event)]
    pub struct WormholeAddressSet {
        pub old_address: ContractAddress,
        pub new_address: ContractAddress,
    }

    #[derive(Drop, Clone, Debug, PartialEq, Serde, starknet::Event)]
    pub struct GovernanceDataSourceSet {
        pub old_data_source: DataSource,
        pub new_data_source: DataSource,
        pub last_executed_governance_sequence: u64,
    }

    #[derive(Drop, Clone, Debug, PartialEq, Serde, starknet::Event)]
    pub struct ContractUpgraded {
        pub new_class_hash: ClassHash,
    }

    #[storage]
    struct Storage {
        wormhole_address: ContractAddress,
        fee_token_address1: ContractAddress,
        fee_token_address2: ContractAddress,
        single_update_fee1: u256,
        single_update_fee2: u256,
        data_sources: Map<usize, DataSource>,
        num_data_sources: usize,
        // For fast validation.
        is_valid_data_source: Map<DataSource, bool>,
        latest_price_info: Map<u256, PriceInfo>,
        governance_data_source: DataSource,
        last_executed_governance_sequence: u64,
        // Governance data source index is used to prevent replay attacks,
        // so a claimVaa cannot be used twice.
        governance_data_source_index: u32,
    }

    /// Initializes the Pyth contract.
    ///
    /// `wormhole_address` is the address of the deployed Wormhole contract implemented in the
    /// `wormhole` module.
    ///
    /// `fee_token_address1` is the address of the ERC20 token used to pay fees to Pyth
    /// for price updates. There is no native token on Starknet so an ERC20 contract has to be used.
    /// On Devnet, an ETH fee contract is pre-deployed. On Starknet testnet, ETH and STRK fee tokens
    /// are available. Any other ERC20-compatible token can also be used.
    /// In a Starknet Forge testing environment, a fee contract must be deployed manually.
    ///
    /// `single_update_fee1` is the number of tokens of `fee_token_address1` charged for a single
    /// price update.
    ///
    /// `fee_token_address2` and `single_update_fee2` specify the secondary fee contract and fee
    /// rate that can be used instead of the main fee token.
    ///
    /// `data_sources` is the list of Wormhole data sources accepted by this contract.
    #[constructor]
    fn constructor(
        ref self: ContractState,
        wormhole_address: ContractAddress,
        fee_token_address1: ContractAddress,
        single_update_fee1: u256,
        fee_token_address2: ContractAddress,
        single_update_fee2: u256,
        data_sources: Array<DataSource>,
        governance_emitter_chain_id: u16,
        governance_emitter_address: u256,
        governance_initial_sequence: u64,
    ) {
        self.wormhole_address.write(wormhole_address);
        self.fee_token_address1.write(fee_token_address1);
        self.single_update_fee1.write(single_update_fee1);
        self.fee_token_address2.write(fee_token_address2);
        self.single_update_fee2.write(single_update_fee2);
        self.write_data_sources(@data_sources);
        self
            .governance_data_source
            .write(
                DataSource {
                    emitter_chain_id: governance_emitter_chain_id,
                    emitter_address: governance_emitter_address,
                },
            );
        self.last_executed_governance_sequence.write(governance_initial_sequence);
    }

    #[abi(embed_v0)]
    impl PythImpl of super::IPyth<ContractState> {
        fn get_price_no_older_than(
            self: @ContractState, price_id: u256, age: u64,
        ) -> Result<Price, GetPriceNoOlderThanError> {
            let info = self.get_price_unsafe(price_id).map_err_into()?;
            if !is_no_older_than(info.publish_time, age) {
                return Result::Err(GetPriceNoOlderThanError::StalePrice);
            }
            Result::Ok(info)
        }

        fn get_price_unsafe(
            self: @ContractState, price_id: u256,
        ) -> Result<Price, GetPriceUnsafeError> {
            let info = self.latest_price_info.entry(price_id).read();
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

        fn get_ema_price_no_older_than(
            self: @ContractState, price_id: u256, age: u64,
        ) -> Result<Price, GetPriceNoOlderThanError> {
            let info = self.get_ema_price_unsafe(price_id).map_err_into()?;
            if !is_no_older_than(info.publish_time, age) {
                return Result::Err(GetPriceNoOlderThanError::StalePrice);
            }
            Result::Ok(info)
        }

        fn get_ema_price_unsafe(
            self: @ContractState, price_id: u256,
        ) -> Result<Price, GetPriceUnsafeError> {
            let info = self.latest_price_info.entry(price_id).read();
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

        fn query_price_feed_no_older_than(
            self: @ContractState, price_id: u256, age: u64,
        ) -> Result<PriceFeed, GetPriceNoOlderThanError> {
            let feed = self.query_price_feed_unsafe(price_id).map_err_into()?;
            if !is_no_older_than(feed.price.publish_time, age) {
                return Result::Err(GetPriceNoOlderThanError::StalePrice);
            }
            Result::Ok(feed)
        }

        fn query_price_feed_unsafe(
            self: @ContractState, price_id: u256,
        ) -> Result<PriceFeed, GetPriceUnsafeError> {
            let info = self.latest_price_info.entry(price_id).read();
            if info.publish_time == 0 {
                return Result::Err(GetPriceUnsafeError::PriceFeedNotFound);
            }
            let feed = PriceFeed {
                id: price_id,
                price: Price {
                    price: info.price,
                    conf: info.conf,
                    expo: info.expo,
                    publish_time: info.publish_time,
                },
                ema_price: Price {
                    price: info.ema_price,
                    conf: info.ema_conf,
                    expo: info.expo,
                    publish_time: info.publish_time,
                },
            };
            Result::Ok(feed)
        }

        fn price_feed_exists(self: @ContractState, price_id: u256) -> bool {
            let info = self.latest_price_info.entry(price_id).read();
            info.publish_time != 0
        }

        fn latest_price_info_publish_time(self: @ContractState, price_id: u256) -> u64 {
            let info = self.latest_price_info.entry(price_id).read();
            info.publish_time
        }

        fn update_price_feeds(ref self: ContractState, data: ByteBuffer) {
            self.update_price_feeds_internal(data, array![], 0, 0, false);
        }

        fn get_update_fee(self: @ContractState, data: ByteBuffer, token: ContractAddress) -> u256 {
            let single_update_fee = if token == self.fee_token_address1.read() {
                self.single_update_fee1.read()
            } else if token == self.fee_token_address2.read() {
                self.single_update_fee2.read()
            } else {
                panic_with_felt252(GetSingleUpdateFeeError::UnsupportedToken.into())
            };

            let mut reader = ReaderImpl::new(data);
            read_and_verify_header(ref reader);
            let wormhole_proof_size = reader.read_u16();
            reader.skip(wormhole_proof_size.into());
            let num_updates = reader.read_u8();
            single_update_fee * num_updates.into()
        }

        fn update_price_feeds_if_necessary(
            ref self: ContractState,
            update: ByteBuffer,
            required_publish_times: Array<PriceFeedPublishTime>,
        ) {
            let mut i = 0;
            let mut found = false;
            while i < required_publish_times.len() {
                let item = required_publish_times.at(i);
                let latest_time = self.latest_price_info.entry(*item.price_id).read().publish_time;
                if latest_time < *item.publish_time {
                    self.update_price_feeds(update);
                    found = true;
                    break;
                }
                i += 1;
            }
            if !found {
                panic_with_felt252(UpdatePriceFeedsIfNecessaryError::NoFreshUpdate.into());
            }
        }

        fn parse_price_feed_updates(
            ref self: ContractState,
            data: ByteBuffer,
            price_ids: Array<u256>,
            min_publish_time: u64,
            max_publish_time: u64,
        ) -> Array<PriceFeed> {
            self
                .update_price_feeds_internal(
                    data, price_ids, min_publish_time, max_publish_time, false,
                )
        }

        fn parse_unique_price_feed_updates(
            ref self: ContractState,
            data: ByteBuffer,
            price_ids: Array<u256>,
            publish_time: u64,
            max_staleness: u64,
        ) -> Array<PriceFeed> {
            self
                .update_price_feeds_internal(
                    data, price_ids, publish_time, publish_time + max_staleness, true,
                )
        }

        fn wormhole_address(self: @ContractState) -> ContractAddress {
            self.wormhole_address.read()
        }

        fn fee_token_addresses(self: @ContractState) -> Array<ContractAddress> {
            array![self.fee_token_address1.read(), self.fee_token_address2.read()]
        }

        fn get_single_update_fee(self: @ContractState, token: ContractAddress) -> u256 {
            if token == self.fee_token_address1.read() {
                self.single_update_fee1.read()
            } else if token == self.fee_token_address2.read() {
                self.single_update_fee2.read()
            } else {
                panic_with_felt252(GetSingleUpdateFeeError::UnsupportedToken.into())
            }
        }

        fn valid_data_sources(self: @ContractState) -> Array<DataSource> {
            let count = self.num_data_sources.read();
            let mut i = 0;
            let mut output = array![];
            while i < count {
                output.append(self.data_sources.entry(i).read());
                i += 1;
            }
            output
        }

        fn is_valid_data_source(self: @ContractState, source: DataSource) -> bool {
            self.is_valid_data_source.entry(source).read()
        }

        fn governance_data_source(self: @ContractState) -> DataSource {
            self.governance_data_source.read()
        }

        fn is_valid_governance_data_source(self: @ContractState, source: DataSource) -> bool {
            self.governance_data_source.read() == source
        }

        fn last_executed_governance_sequence(self: @ContractState) -> u64 {
            self.last_executed_governance_sequence.read()
        }

        fn governance_data_source_index(self: @ContractState) -> u32 {
            self.governance_data_source_index.read()
        }

        fn chain_id(self: @ContractState) -> u16 {
            let wormhole = IWormholeDispatcher { contract_address: self.wormhole_address.read() };
            wormhole.chain_id()
        }

        fn execute_governance_instruction(ref self: ContractState, data: ByteBuffer) {
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
                    self.set_fee(payload.value, payload.expo, self.fee_token_address1.read());
                },
                GovernancePayload::SetFeeInToken(payload) => {
                    self.set_fee(payload.value, payload.expo, payload.token);
                },
                GovernancePayload::SetDataSources(payload) => {
                    let new_data_sources = payload.sources;
                    let old_data_sources = self.write_data_sources(@new_data_sources);
                    let event = DataSourcesSet { old_data_sources, new_data_sources };
                    self.emit(event);
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
                GovernancePayload::UpgradeContract(payload) => {
                    if instruction.target_chain_id == 0 {
                        panic_with_felt252(GovernanceActionError::InvalidGovernanceTarget.into());
                    }
                    self.upgrade_contract(payload.new_implementation);
                },
            }
        }

        fn version(self: @ContractState) -> felt252 {
            '0.1.0'
        }

        fn pyth_upgradable_magic(self: @ContractState) -> u32 {
            0x97a6f304
        }
    }

    #[generate_trait]
    impl PrivateImpl of PrivateTrait {
        fn write_data_sources(
            ref self: ContractState, data_sources: @Array<DataSource>,
        ) -> Array<DataSource> {
            let num_old = self.num_data_sources.read();
            let mut i = 0;
            let mut old_data_sources = array![];
            while i < num_old {
                let old_source = self.data_sources.entry(i).read();
                old_data_sources.append(old_source);
                self.is_valid_data_source.entry(old_source).write(false);
                self.data_sources.entry(i).write(Default::default());
                i += 1;
            }

            self.num_data_sources.write(data_sources.len());
            i = 0;
            while i < data_sources.len() {
                let source = data_sources.at(i);
                self.is_valid_data_source.entry(*source).write(true);
                self.data_sources.entry(i).write(*source);
                i += 1;
            }
            old_data_sources
        }

        fn update_latest_price_if_necessary(ref self: ContractState, message: @PriceFeedMessage) {
            let latest_publish_time = self
                .latest_price_info
                .entry(*message.price_id)
                .read()
                .publish_time;
            if *message.publish_time > latest_publish_time {
                let info = PriceInfo {
                    price: *message.price,
                    conf: *message.conf,
                    expo: *message.expo,
                    publish_time: *message.publish_time,
                    ema_price: *message.ema_price,
                    ema_conf: *message.ema_conf,
                };
                self.latest_price_info.entry(*message.price_id).write(info);

                let event = PriceFeedUpdated {
                    price_id: *message.price_id,
                    publish_time: *message.publish_time,
                    price: *message.price,
                    conf: *message.conf,
                };
                self.emit(event);
            }
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
            ref self: ContractState, wormhole_address: ContractAddress, vm: ByteBuffer,
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
            // Purposefully, we don't check whether the chainId is the same as the current chainId
            // because we might want to change the chain id of the wormhole contract.
            let data = governance::parse_instruction(vm.payload);
            match data.payload {
                GovernancePayload::SetWormholeAddress(payload) => {
                    // The following check is not necessary for security, but is a sanity check that
                    // the new wormhole contract parses the payload correctly.
                    if payload.address != wormhole_address {
                        panic_with_felt252(
                            GovernanceActionError::InvalidWormholeAddressToSet.into(),
                        );
                    }
                },
                _ => {
                    panic_with_felt252(GovernanceActionError::InvalidWormholeAddressToSet.into());
                },
            }
        }

        fn authorize_governance_transfer(ref self: ContractState, claim_vaa: ByteBuffer) {
            let wormhole = IWormholeDispatcher { contract_address: self.wormhole_address.read() };
            let claim_vm = wormhole.parse_and_verify_vm(claim_vaa.clone());
            // Note: no verify_governance_vm() because claim_vaa is signed by the new data source
            let instruction = governance::parse_instruction(claim_vm.payload.clone());
            if instruction.target_chain_id != 0
                && instruction.target_chain_id != wormhole.chain_id() {
                panic_with_felt252(GovernanceActionError::InvalidGovernanceTarget.into());
            }
            let request_payload = match instruction.payload {
                GovernancePayload::RequestGovernanceDataSourceTransfer(payload) => payload,
                _ => { panic_with_felt252(GovernanceActionError::InvalidGovernanceMessage.into()) },
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
            let new_data_source = claim_vm.data_source();
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

        fn upgrade_contract(ref self: ContractState, new_implementation: ClassHash) {
            let contract_address = get_contract_address();
            replace_class_syscall(new_implementation).unwrap_syscall();
            // Dispatcher uses `call_contract_syscall` so it will call the new implementation.
            let magic = IPythDispatcher { contract_address }.pyth_upgradable_magic();
            if magic != 0x97a6f304 {
                panic_with_felt252(GovernanceActionError::InvalidGovernanceMessage.into());
            }
            let event = ContractUpgraded { new_class_hash: new_implementation };
            self.emit(event);
        }

        // Applies all price feed updates encoded in `data` and extracts requested information
        // about the new updates. `price_ids` specifies price feeds of interest. The output will
        // contain as many items as `price_ids`, with price feeds returned in the same order as
        // specified in `price_ids`.
        //
        // If `unique == false`, for each price feed, the first encountered update
        // in the specified time interval (both timestamps inclusive) will be returned.
        // If `unique == true`, the globally unique first update will be returned, as verified by
        // the `prev_publish_time` value of the update. Panics if a matching update was not found
        // for any of the specified feeds.
        fn update_price_feeds_internal(
            ref self: ContractState,
            data: ByteBuffer,
            price_ids: Array<u256>,
            min_publish_time: u64,
            max_publish_time: u64,
            unique: bool,
        ) -> Array<PriceFeed> {
            let mut output: Felt252Dict<Nullable<PriceFeed>> = Default::default();
            let mut reader = ReaderImpl::new(data);
            read_and_verify_header(ref reader);
            let wormhole_proof_size = reader.read_u16();
            let wormhole_proof = reader.read_byte_array(wormhole_proof_size.into());

            let wormhole = IWormholeDispatcher { contract_address: self.wormhole_address.read() };
            let vm = wormhole.parse_and_verify_vm(wormhole_proof);

            if !self.is_valid_data_source.entry(vm.data_source()).read() {
                panic_with_felt252(UpdatePriceFeedsError::InvalidUpdateDataSource.into());
            }

            let root_digest = parse_wormhole_proof(vm.payload);

            let num_updates = reader.read_u8();
            let execution_info = get_execution_info().unbox();
            let caller = execution_info.caller_address;
            let contract = execution_info.contract_address;
            let fee1_transfered = transfer_fee(
                num_updates,
                caller,
                contract,
                self.fee_token_address1.read(),
                self.single_update_fee1.read(),
            );
            if !fee1_transfered {
                let fee2_transfered = transfer_fee(
                    num_updates,
                    caller,
                    contract,
                    self.fee_token_address2.read(),
                    self.single_update_fee2.read(),
                );
                if !fee2_transfered {
                    panic_with_felt252(UpdatePriceFeedsError::InsufficientFeeAllowance.into());
                }
            }

            let mut i = 0;
            let price_ids2 = @price_ids;
            while i < num_updates {
                let message = read_and_verify_message(ref reader, root_digest);
                self.update_latest_price_if_necessary(@message);

                let output_index = find_index_of_price_id(price_ids2, message.price_id);
                match output_index {
                    Option::Some(output_index) => {
                        if output.get(output_index.into()).is_null() {
                            let should_output = message.publish_time >= min_publish_time
                                && message.publish_time <= max_publish_time
                                && (!unique || min_publish_time > message.prev_publish_time);
                            if should_output {
                                output
                                    .insert(
                                        output_index.into(), NullableTrait::new(message.into()),
                                    );
                            }
                        }
                    },
                    Option::None => {},
                }

                i += 1;
            }

            if reader.len() != 0 {
                panic_with_felt252(UpdatePriceFeedsError::InvalidUpdateData.into());
            }

            let mut output_array = array![];
            let mut i = 0;
            while i < price_ids.len() {
                let value = output.get(i.into());
                match match_nullable(value) {
                    FromNullableResult::Null => {
                        panic_with_felt252(
                            ParsePriceFeedsError::PriceFeedNotFoundWithinRange.into(),
                        )
                    },
                    FromNullableResult::NotNull(value) => { output_array.append(value.unbox()); },
                }
                i += 1;
            }
            output_array
        }

        fn set_fee(ref self: ContractState, value: u64, expo: u64, token: ContractAddress) {
            let new_fee = apply_decimal_expo(value, expo);
            let old_fee = if token == self.fee_token_address1.read() {
                let old_fee = self.single_update_fee1.read();
                self.single_update_fee1.write(new_fee);
                old_fee
            } else if token == self.fee_token_address2.read() {
                let old_fee = self.single_update_fee2.read();
                self.single_update_fee2.write(new_fee);
                old_fee
            } else {
                panic_with_felt252(GovernanceActionError::InvalidGovernanceMessage.into())
            };
            let event = FeeSet { old_fee, new_fee, token };
            self.emit(event);
        }
    }

    fn apply_decimal_expo(value: u64, expo: u64) -> u256 {
        let mut output: u256 = value.into();
        let mut i = 0;
        while i < expo {
            output *= 10;
            i += 1;
        }
        output
    }

    fn is_no_older_than(publish_time: u64, age: u64) -> bool {
        let current = get_block_timestamp();
        let actual_age = if current >= publish_time {
            current - publish_time
        } else {
            0
        };
        actual_age <= age
    }

    fn find_index_of_price_id(ids: @Array<u256>, value: u256) -> Option<usize> {
        let mut i = 0;
        while i < ids.len() {
            if ids.at(i) == @value {
                break;
            }
            i += 1;
        }
        if i == ids.len() {
            Option::None
        } else {
            Option::Some(i)
        }
    }

    fn transfer_fee(
        num_updates: u8,
        caller: ContractAddress,
        contract: ContractAddress,
        fee_token: ContractAddress,
        single_update_fee1: u256,
    ) -> bool {
        let total_fee = single_update_fee1 * num_updates.into();
        let fee_contract = IERC20CamelDispatcher { contract_address: fee_token };
        if fee_contract.allowance(caller, contract) < total_fee {
            return false;
        }
        if fee_contract.balanceOf(caller) < total_fee {
            return false;
        }
        if !fee_contract.transferFrom(caller, contract, total_fee) {
            return false;
        }
        true
    }
}
