// Only used for tests.

#[starknet::contract]
mod pyth_fake_upgrade1 {
    use pyth::pyth::{IPyth, GetPriceUnsafeError, DataSource, Price};
    use pyth::byte_array::ByteArray;

    #[storage]
    struct Storage {}

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl PythImpl of IPyth<ContractState> {
        fn get_price_unsafe(
            self: @ContractState, price_id: u256
        ) -> Result<Price, GetPriceUnsafeError> {
            let price = Price { price: 42, conf: 2, expo: -5, publish_time: 101, };
            Result::Ok(price)
        }
        fn get_ema_price_unsafe(
            self: @ContractState, price_id: u256
        ) -> Result<Price, GetPriceUnsafeError> {
            panic!("unsupported")
        }
        fn set_data_sources(ref self: ContractState, sources: Array<DataSource>) {
            panic!("unsupported")
        }
        fn set_fee(ref self: ContractState, single_update_fee: u256) {
            panic!("unsupported")
        }
        fn update_price_feeds(ref self: ContractState, data: ByteArray) {
            panic!("unsupported")
        }
        fn execute_governance_instruction(ref self: ContractState, data: ByteArray) {
            panic!("unsupported")
        }
        fn pyth_upgradable_magic(self: @ContractState) -> u32 {
            0x97a6f304
        }
    }
}

#[starknet::contract]
mod pyth_fake_upgrade_wrong_magic {
    use pyth::pyth::{IPyth, GetPriceUnsafeError, DataSource, Price};
    use pyth::byte_array::ByteArray;

    #[storage]
    struct Storage {}

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl PythImpl of IPyth<ContractState> {
        fn get_price_unsafe(
            self: @ContractState, price_id: u256
        ) -> Result<Price, GetPriceUnsafeError> {
            panic!("unsupported")
        }
        fn get_ema_price_unsafe(
            self: @ContractState, price_id: u256
        ) -> Result<Price, GetPriceUnsafeError> {
            panic!("unsupported")
        }
        fn set_data_sources(ref self: ContractState, sources: Array<DataSource>) {
            panic!("unsupported")
        }
        fn set_fee(ref self: ContractState, single_update_fee: u256) {
            panic!("unsupported")
        }
        fn update_price_feeds(ref self: ContractState, data: ByteArray) {
            panic!("unsupported")
        }
        fn execute_governance_instruction(ref self: ContractState, data: ByteArray) {
            panic!("unsupported")
        }
        fn pyth_upgradable_magic(self: @ContractState) -> u32 {
            606
        }
    }
}

#[starknet::interface]
pub trait INotPyth<T> {
    fn test1(ref self: T) -> u32;
}

#[starknet::contract]
mod pyth_fake_upgrade_not_pyth {
    #[storage]
    struct Storage {}

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl NotPythImpl of super::INotPyth<ContractState> {
        fn test1(ref self: ContractState) -> u32 {
            42
        }
    }
}
