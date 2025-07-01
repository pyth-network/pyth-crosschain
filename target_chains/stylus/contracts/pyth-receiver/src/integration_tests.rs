#[cfg(test)]
mod test {
    use super::*;
    use alloy_primitives::address;
    use stylus_sdk::testing::*;

    #[test]
    fn test_initialize() {
        // Set up test environment
        let vm = TestVM::default();
        // Initialize your contract
        let mut contract = PythReceiver::from(&vm);

        let wormhole_address = address!("0x3F38404A2e3Cb949bcDfA19a5C3bDf3fE375fEb0");

    }
}