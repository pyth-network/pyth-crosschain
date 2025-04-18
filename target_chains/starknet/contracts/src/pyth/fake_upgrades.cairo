use pyth::pyth::{GetPriceUnsafeError, Price};

// Only used for tests.

#[starknet::interface]
pub trait IFakePyth<T> {
    fn get_price_unsafe(self: @T, price_id: u256) -> Result<Price, GetPriceUnsafeError>;
    fn pyth_upgradable_magic(self: @T) -> u32;
}

#[starknet::contract]
mod pyth_fake_upgrade1 {
    use pyth::pyth::{GetPriceUnsafeError, Price};

    #[storage]
    struct Storage {}

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl PythImpl of super::IFakePyth<ContractState> {
        fn get_price_unsafe(
            self: @ContractState, price_id: u256,
        ) -> Result<Price, GetPriceUnsafeError> {
            let price = Price { price: 42, conf: 2, expo: -5, publish_time: 101 };
            Result::Ok(price)
        }
        fn pyth_upgradable_magic(self: @ContractState) -> u32 {
            0x97a6f304
        }
    }
}

#[starknet::contract]
mod pyth_fake_upgrade_wrong_magic {
    use pyth::pyth::{GetPriceUnsafeError, Price};

    #[storage]
    struct Storage {}

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl PythImpl of super::IFakePyth<ContractState> {
        fn get_price_unsafe(
            self: @ContractState, price_id: u256,
        ) -> Result<Price, GetPriceUnsafeError> {
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
