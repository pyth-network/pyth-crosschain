use core::array::ArrayTrait;
use core::fmt::{Debug, Formatter};
use super::byte_array::ByteArray;
use super::util::UnwrapWithFelt252;

pub use pyth::{Event, PriceFeedUpdateEvent};

#[starknet::interface]
pub trait IPyth<T> {
    fn get_price_unsafe(self: @T, price_id: u256) -> Result<Price, GetPriceUnsafeError>;
    fn get_ema_price_unsafe(self: @T, price_id: u256) -> Result<Price, GetPriceUnsafeError>;
    fn set_data_sources(
        ref self: T, sources: Array<DataSource>
    ) -> Result<(), GovernanceActionError>;
    fn set_fee(ref self: T, single_update_fee: u256) -> Result<(), GovernanceActionError>;
    fn update_price_feeds(ref self: T, data: ByteArray) -> Result<(), UpdatePriceFeedsError>;
}

#[derive(Copy, Drop, Debug, Serde, PartialEq)]
pub enum GetPriceUnsafeError {
    PriceFeedNotFound,
}

pub impl GetPriceUnsafeErrorUnwrapWithFelt252<T> of UnwrapWithFelt252<T, GetPriceUnsafeError> {
    fn unwrap_with_felt252(self: Result<T, GetPriceUnsafeError>) -> T {
        match self {
            Result::Ok(v) => v,
            Result::Err(err) => core::panic_with_felt252(err.into()),
        }
    }
}

impl GetPriceUnsafeErrorIntoFelt252 of Into<GetPriceUnsafeError, felt252> {
    fn into(self: GetPriceUnsafeError) -> felt252 {
        match self {
            GetPriceUnsafeError::PriceFeedNotFound => 'price feed not found',
        }
    }
}

#[derive(Copy, Drop, Debug, Serde, PartialEq)]
pub enum GovernanceActionError {
    AccessDenied,
}

pub impl GovernanceActionErrorUnwrapWithFelt252<T> of UnwrapWithFelt252<T, GovernanceActionError> {
    fn unwrap_with_felt252(self: Result<T, GovernanceActionError>) -> T {
        match self {
            Result::Ok(v) => v,
            Result::Err(err) => core::panic_with_felt252(err.into()),
        }
    }
}

impl GovernanceActionErrorIntoFelt252 of Into<GovernanceActionError, felt252> {
    fn into(self: GovernanceActionError) -> felt252 {
        match self {
            GovernanceActionError::AccessDenied => 'access denied',
        }
    }
}

#[derive(Copy, Drop, Debug, Serde, PartialEq)]
pub enum UpdatePriceFeedsError {
    Reader: super::reader::Error,
    Wormhole: super::wormhole::ParseAndVerifyVmError,
    InvalidUpdateData,
    InvalidUpdateDataSource,
    InsufficientFee,
}

pub impl UpdatePriceFeedsErrorUnwrapWithFelt252<T> of UnwrapWithFelt252<T, UpdatePriceFeedsError> {
    fn unwrap_with_felt252(self: Result<T, UpdatePriceFeedsError>) -> T {
        match self {
            Result::Ok(v) => v,
            Result::Err(err) => core::panic_with_felt252(err.into()),
        }
    }
}

impl UpdatePriceFeedsErrorIntoFelt252 of Into<UpdatePriceFeedsError, felt252> {
    fn into(self: UpdatePriceFeedsError) -> felt252 {
        match self {
            UpdatePriceFeedsError::Reader(err) => err.into(),
            UpdatePriceFeedsError::Wormhole(err) => err.into(),
            UpdatePriceFeedsError::InvalidUpdateData => 'invalid update data',
            UpdatePriceFeedsError::InvalidUpdateDataSource => 'invalid update data source',
            UpdatePriceFeedsError::InsufficientFee => 'insufficient fee',
        }
    }
}

#[derive(Drop, Debug, Clone, Copy, Hash, Default, Serde, starknet::Store)]
pub struct DataSource {
    pub emitter_chain_id: u16,
    pub emitter_address: u256,
}

#[derive(Drop, Clone, Serde, starknet::Store)]
struct PriceInfo {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
    pub ema_price: i64,
    pub ema_conf: u64,
}

#[derive(Drop, Clone, Serde)]
struct Price {
    pub price: i64,
    pub conf: u64,
    pub expo: i32,
    pub publish_time: u64,
}

#[starknet::contract]
mod pyth {
    use pyth::reader::ReaderTrait;
    use pyth::reader::{Reader, ReaderImpl};
    use pyth::byte_array::{ByteArray, ByteArrayImpl};
    use core::panic_with_felt252;
    use core::starknet::{ContractAddress, get_caller_address, get_execution_info};
    use pyth::wormhole::{IWormholeDispatcher, IWormholeDispatcherTrait};
    use super::{
        DataSource, UpdatePriceFeedsError, PriceInfo, GovernanceActionError, Price,
        GetPriceUnsafeError
    };
    use pyth::merkle_tree::{read_and_verify_proof, MerkleVerificationError};
    use pyth::hash::{Hasher, HasherImpl};
    use core::fmt::{Debug, Formatter};
    use pyth::util::{u64_as_i64, u32_as_i32};
    use openzeppelin::token::erc20::interface::{IERC20CamelDispatcherTrait, IERC20CamelDispatcher};

    // Stands for PNAU (Pyth Network Accumulator Update)
    const ACCUMULATOR_MAGIC: u32 = 0x504e4155;
    // Stands for AUWV (Accumulator Update Wormhole Verficiation)
    const ACCUMULATOR_WORMHOLE_MAGIC: u32 = 0x41555756;
    const MAJOR_VERSION: u8 = 1;
    const MINIMUM_ALLOWED_MINOR_VERSION: u8 = 0;

    #[event]
    #[derive(Drop, PartialEq, starknet::Event)]
    pub enum Event {
        PriceFeedUpdate: PriceFeedUpdateEvent,
    }

    #[derive(Drop, PartialEq, starknet::Event)]
    pub struct PriceFeedUpdateEvent {
        #[key]
        pub price_id: u256,
        pub publish_time: u64,
        pub price: i64,
        pub conf: u64,
    }

    #[generate_trait]
    impl ResultReaderToUpdatePriceFeeds<T> of ResultReaderToUpdatePriceFeedsTrait<T> {
        fn map_err(self: Result<T, pyth::reader::Error>) -> Result<T, UpdatePriceFeedsError> {
            match self {
                Result::Ok(v) => Result::Ok(v),
                Result::Err(err) => Result::Err(UpdatePriceFeedsError::Reader(err)),
            }
        }
    }

    #[generate_trait]
    impl ResultWormholeToUpdatePriceFeeds<T> of ResultWormholeToUpdatePriceFeedsTrait<T> {
        fn map_err(
            self: Result<T, pyth::wormhole::ParseAndVerifyVmError>
        ) -> Result<T, UpdatePriceFeedsError> {
            match self {
                Result::Ok(v) => Result::Ok(v),
                Result::Err(err) => Result::Err(UpdatePriceFeedsError::Wormhole(err)),
            }
        }
    }

    #[generate_trait]
    impl ResultMerkleToUpdatePriceFeeds<T> of ResultMerkleToUpdatePriceFeedsTrait<T> {
        fn map_err(self: Result<T, MerkleVerificationError>) -> Result<T, UpdatePriceFeedsError> {
            match self {
                Result::Ok(v) => Result::Ok(v),
                Result::Err(err) => {
                    let err = match err {
                        MerkleVerificationError::Reader(err) => UpdatePriceFeedsError::Reader(err),
                        MerkleVerificationError::DigestMismatch => UpdatePriceFeedsError::InvalidUpdateData,
                    };
                    Result::Err(err)
                },
            }
        }
    }

    #[derive(Drop)]
    enum UpdateType {
        WormholeMerkle
    }

    impl U8TryIntoUpdateType of TryInto<u8, UpdateType> {
        fn try_into(self: u8) -> Option<UpdateType> {
            if self == 0 {
                Option::Some(UpdateType::WormholeMerkle)
            } else {
                Option::None
            }
        }
    }

    #[derive(Drop)]
    enum MessageType {
        PriceFeed
    }

    impl U8TryIntoMessageType of TryInto<u8, MessageType> {
        fn try_into(self: u8) -> Option<MessageType> {
            if self == 0 {
                Option::Some(MessageType::PriceFeed)
            } else {
                Option::None
            }
        }
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
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        wormhole_address: ContractAddress,
        fee_contract_address: ContractAddress,
        single_update_fee: u256,
        data_sources: Array<DataSource>
    ) {
        self.owner.write(wormhole_address);
        self.wormhole_address.write(wormhole_address);
        self.fee_contract_address.write(fee_contract_address);
        self.single_update_fee.write(single_update_fee);
        write_data_sources(ref self, data_sources);
    }

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

    #[derive(Drop)]
    struct PriceFeedMessage {
        price_id: u256,
        price: i64,
        conf: u64,
        expo: i32,
        publish_time: u64,
        prev_publish_time: u64,
        ema_price: i64,
        ema_conf: u64,
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

        fn set_data_sources(
            ref self: ContractState, sources: Array<DataSource>
        ) -> Result<(), GovernanceActionError> {
            if self.owner.read() != get_caller_address() {
                return Result::Err(GovernanceActionError::AccessDenied);
            }
            write_data_sources(ref self, sources);
            Result::Ok(())
        }

        fn set_fee(
            ref self: ContractState, single_update_fee: u256
        ) -> Result<(), GovernanceActionError> {
            if self.owner.read() != get_caller_address() {
                return Result::Err(GovernanceActionError::AccessDenied);
            }
            self.single_update_fee.write(single_update_fee);
            Result::Ok(())
        }

        fn update_price_feeds(
            ref self: ContractState, data: ByteArray
        ) -> Result<(), UpdatePriceFeedsError> {
            let mut reader = ReaderImpl::new(data);
            let x = reader.read_u32().map_err()?;
            if x != ACCUMULATOR_MAGIC {
                return Result::Err(UpdatePriceFeedsError::InvalidUpdateData);
            }
            if reader.read_u8().map_err()? != MAJOR_VERSION {
                return Result::Err(UpdatePriceFeedsError::InvalidUpdateData);
            }
            if reader.read_u8().map_err()? < MINIMUM_ALLOWED_MINOR_VERSION {
                return Result::Err(UpdatePriceFeedsError::InvalidUpdateData);
            }

            let trailing_header_size = reader.read_u8().map_err()?;
            reader.skip(trailing_header_size).map_err()?;

            let update_type: Option<UpdateType> = reader.read_u8().map_err()?.try_into();
            match update_type {
                Option::Some(v) => match v {
                    UpdateType::WormholeMerkle => {}
                },
                Option::None => { return Result::Err(UpdatePriceFeedsError::InvalidUpdateData); }
            };

            let wh_proof_size = reader.read_u16().map_err()?;
            let wh_proof = reader.read_byte_array(wh_proof_size.into()).map_err()?;
            let wormhole = IWormholeDispatcher { contract_address: self.wormhole_address.read() };
            let vm = wormhole.parse_and_verify_vm(wh_proof).map_err()?;

            let source = DataSource {
                emitter_chain_id: vm.emitter_chain_id, emitter_address: vm.emitter_address
            };
            if !self.is_valid_data_source.read(source) {
                return Result::Err(UpdatePriceFeedsError::InvalidUpdateDataSource);
            }

            let mut payload_reader = ReaderImpl::new(vm.payload);
            let x = payload_reader.read_u32().map_err()?;
            if x != ACCUMULATOR_WORMHOLE_MAGIC {
                return Result::Err(UpdatePriceFeedsError::InvalidUpdateData);
            }

            let update_type: Option<UpdateType> = payload_reader.read_u8().map_err()?.try_into();
            match update_type {
                Option::Some(v) => match v {
                    UpdateType::WormholeMerkle => {}
                },
                Option::None => { return Result::Err(UpdatePriceFeedsError::InvalidUpdateData); }
            };

            let _slot = payload_reader.read_u64().map_err()?;
            let _ring_size = payload_reader.read_u32().map_err()?;
            let root_digest = payload_reader.read_u160().map_err()?;

            let num_updates = reader.read_u8().map_err()?;

            let total_fee = get_total_fee(ref self, num_updates);
            let fee_contract = IERC20CamelDispatcher {
                contract_address: self.fee_contract_address.read()
            };
            let execution_info = get_execution_info().unbox();
            let caller = execution_info.caller_address;
            let contract = execution_info.contract_address;
            if fee_contract.allowance(caller, contract) < total_fee {
                return Result::Err(UpdatePriceFeedsError::InsufficientFee);
            }
            if !fee_contract.transferFrom(caller, contract, total_fee) {
                return Result::Err(UpdatePriceFeedsError::InsufficientFee);
            }

            let mut i = 0;
            let mut result = Result::Ok(());
            while i < num_updates {
                let r = read_and_verify_message(ref reader, root_digest);
                match r {
                    Result::Ok(message) => { update_latest_price_if_necessary(ref self, message); },
                    Result::Err(err) => {
                        result = Result::Err(err);
                        break;
                    }
                }
                i += 1;
            };
            result?;

            if reader.len() != 0 {
                return Result::Err(UpdatePriceFeedsError::InvalidUpdateData);
            }

            Result::Ok(())
        }
    }

    fn read_and_verify_message(
        ref reader: Reader, root_digest: u256
    ) -> Result<PriceFeedMessage, UpdatePriceFeedsError> {
        let message_size = reader.read_u16().map_err()?;
        let message = reader.read_byte_array(message_size.into()).map_err()?;
        read_and_verify_proof(root_digest, @message, ref reader).map_err()?;

        let mut message_reader = ReaderImpl::new(message);
        let message_type: Option<MessageType> = message_reader.read_u8().map_err()?.try_into();
        match message_type {
            Option::Some(v) => match v {
                MessageType::PriceFeed => {}
            },
            Option::None => { return Result::Err(UpdatePriceFeedsError::InvalidUpdateData); }
        };

        let price_id = message_reader.read_u256().map_err()?;
        let price = u64_as_i64(message_reader.read_u64().map_err()?);
        let conf = message_reader.read_u64().map_err()?;
        let expo = u32_as_i32(message_reader.read_u32().map_err()?);
        let publish_time = message_reader.read_u64().map_err()?;
        let prev_publish_time = message_reader.read_u64().map_err()?;
        let ema_price = u64_as_i64(message_reader.read_u64().map_err()?);
        let ema_conf = message_reader.read_u64().map_err()?;

        let message = PriceFeedMessage {
            price_id, price, conf, expo, publish_time, prev_publish_time, ema_price, ema_conf,
        };
        Result::Ok(message)
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
}
