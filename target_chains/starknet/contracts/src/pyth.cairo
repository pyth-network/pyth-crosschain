#[starknet::interface]
trait IPyth<T> {
    fn get_name(self: @T) -> felt252;
    fn set_name(ref self: T, name: felt252);
}

#[starknet::contract]
mod pyth {
    #[storage]
    struct Storage {
        name: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, name: felt252) {
        self.name.write(name);
    }

    #[abi(embed_v0)]
    impl HelloImpl of super::IPyth<ContractState> {
        fn get_name(self: @ContractState) -> felt252 {
            self.name.read() + 1
        }

        fn set_name(ref self: ContractState, name: felt252) {
            self.name.write(name - 1);
        }
    }
}
