#[cfg(test)]
mod test {
    use crate::PythReceiver;
    use alloy_primitives::{address, U256};
    use stylus_sdk::testing::*;

    #[test]
    fn test_initialize() {
        // Set up test environment
        let vm = TestVM::default();
        // Initialize your contract
        let mut contract = PythReceiver::from(&vm);

        let wormhole_address = address!("0x3F38404A2e3Cb949bcDfA19a5C3bDf3fE375fEb0");
        let single_update_fee = U256::from(100u64);
        let valid_time_period = U256::from(3600u64); // 1 hour
        
        let data_source_chain_ids = vec![1u16, 2u16]; // Ethereum and other chain
        let data_source_emitter_addresses = vec![
            [1u8; 32], // First emitter address
            [2u8; 32], // Second emitter address
        ];
        
        let governance_chain_id = 1u16;
        let governance_emitter_address = [3u8; 32];
        let governance_initial_sequence = 0u64;
        let data = vec![]; // Empty data for this test

        contract.initialize(
            wormhole_address,
            single_update_fee,
            valid_time_period,
            data_source_chain_ids.clone(),
            data_source_emitter_addresses.clone(),
            governance_chain_id,
            governance_emitter_address,
            governance_initial_sequence,
            data,
        );

        let fee = contract.get_update_fee(vec![]);
        assert_eq!(fee, U256::from(0u8)); // Should return 0 as per implementation
        
        let twap_fee = contract.get_twap_update_fee(vec![]);
        assert_eq!(twap_fee, U256::from(0u8)); // Should return 0 as per implementation
        
        let test_price_id = [0u8; 32];
        let price_result = contract.get_price_unsafe(test_price_id);
        assert!(price_result.is_err()); // Should return error for non-existent price
    }
}
