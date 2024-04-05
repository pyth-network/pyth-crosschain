#[starknet::interface]
trait IWormhole<T> {
    fn get_value(self: @T) -> felt252;
    fn set_value(ref self: T, name: felt252);
}

#[starknet::contract]
mod wormhole {
    #[storage]
    struct Storage {
        name: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, name: felt252) {
        self.name.write(name);
    }

    #[abi(embed_v0)]
    impl HelloImpl of super::IWormhole<ContractState> {
        fn get_value(self: @ContractState) -> felt252 {
            self.name.read() + 2
        }

        fn set_value(ref self: ContractState, name: felt252) {
            self.name.write(name - 2);
        }
    }
}
