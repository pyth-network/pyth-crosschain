#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]

#[cfg(not(any(test, feature = "export-abi")))]
#[no_mangle]
pub extern "C" fn main() {}

#[cfg(feature = "export-abi")]
fn main() {
    use pyth_receiver_stylus::PythReceiver;
    stylus_sdk::abi::export::print_abi::<PythReceiver>("pyth-receiver-stylus", include_str!("../Cargo.toml"));
}
