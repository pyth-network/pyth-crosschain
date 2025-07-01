
#[cfg(test)]
mod test {
    use crate::PythReceiver;
    use crate::error::PythReceiverError;
    use alloy_primitives::{address, U256};
    use stylus_sdk::testing::*;
    use pythnet_sdk::wire::v1::PYTHNET_ACCUMULATOR_UPDATE_MAGIC;

    fn initialize_test_contract(vm: &TestVM) -> PythReceiver {
        let mut contract = PythReceiver::from(vm);
        let wormhole_address = address!("0x3F38404A2e3Cb949bcDfA19a5C3bDf3fE375fEb0");
        let single_update_fee = U256::from(100u64);
        let valid_time_period = U256::from(3600u64);
        
        let data_source_chain_ids = vec![1u16, 2u16];
        let data_source_emitter_addresses = vec![
            [1u8; 32],
            [2u8; 32],
        ];
        
        let governance_chain_id = 1u16;
        let governance_emitter_address = [3u8; 32];
        let governance_initial_sequence = 0u64;
        let data = vec![];

        contract.initialize(
            wormhole_address,
            single_update_fee,
            valid_time_period,
            data_source_chain_ids,
            data_source_emitter_addresses,
            governance_chain_id,
            governance_emitter_address,
            governance_initial_sequence,
            data,
        );
        contract
    }

    fn create_valid_update_data() -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(PYTHNET_ACCUMULATOR_UPDATE_MAGIC);
        data.extend_from_slice(&[0u8; 100]);
        data
    }

    fn create_invalid_magic_data() -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&[0xFF, 0xFF, 0xFF, 0xFF]); // Invalid magic
        data.extend_from_slice(&[0u8; 100]);
        data
    }

    fn create_short_data() -> Vec<u8> {
        vec![0u8; 2] // Too short for magic header
    }

    fn create_invalid_vaa_data() -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(PYTHNET_ACCUMULATOR_UPDATE_MAGIC);
        data.extend_from_slice(&[0u8; 50]);
        data
    }

    fn create_invalid_merkle_data() -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(PYTHNET_ACCUMULATOR_UPDATE_MAGIC);
        data.extend_from_slice(&[1u8; 80]);
        data
    }

    #[test]
    fn test_initialize() {
        let vm = TestVM::default();
        let mut contract = PythReceiver::from(&vm);

        let wormhole_address = address!("0x3F38404A2e3Cb949bcDfA19a5C3bDf3fE375fEb0");
        let single_update_fee = U256::from(100u64);
        let valid_time_period = U256::from(3600u64);
        
        let data_source_chain_ids = vec![1u16, 2u16];
        let data_source_emitter_addresses = vec![
            [1u8; 32],
            [2u8; 32],
        ];
        
        let governance_chain_id = 1u16;
        let governance_emitter_address = [3u8; 32];
        let governance_initial_sequence = 0u64;
        let data = vec![];

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
        assert_eq!(fee, U256::from(0u8)); // Fee calculation not implemented yet
        
        let twap_fee = contract.get_twap_update_fee(vec![]);
        assert_eq!(twap_fee, U256::from(0u8)); // Fee calculation not implemented yet
        
        let test_price_id = [0u8; 32];
        let price_result = contract.get_price_unsafe(test_price_id);
        assert!(price_result.is_err());
        assert!(matches!(price_result.unwrap_err(), PythReceiverError::PriceUnavailable));
    }

    #[test]
    fn test_update_new_price_feed() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);
        
        let test_price_id = [1u8; 32];
        
        let update_data = create_valid_update_data();
        let result = contract.update_price_feeds(
            update_data, 
        );
        
        
        let price_result = contract.get_price_unsafe(test_price_id);
        assert!(price_result.is_err());
        assert!(matches!(price_result.unwrap_err(), PythReceiverError::PriceUnavailable));
    }

    #[test]
    fn test_update_existing_price_feed() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);
        
        let test_price_id = [1u8; 32];
        
        let update_data1 = create_valid_update_data();
        let result1 = contract.update_price_feeds_internal(
            update_data1, 
            vec![], 
            0, 
            u64::MAX, 
            false
        );
        
        let update_data2 = create_valid_update_data();
        let result2 = contract.update_price_feeds_internal(
            update_data2, 
            vec![], 
            0, 
            u64::MAX, 
            false
        );
        
    }

    #[test]
    fn test_invalid_magic_header() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);
        
        let invalid_data = create_invalid_magic_data();
        let result = contract.update_price_feeds_internal(
            invalid_data, 
            vec![], 
            0, 
            u64::MAX, 
            false
        );
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), PythReceiverError::InvalidAccumulatorMessage));
    }

    #[test]
    fn test_invalid_wire_format() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);
        
        let short_data = create_short_data();
        let result = contract.update_price_feeds_internal(
            short_data, 
            vec![], 
            0, 
            u64::MAX, 
            false
        );
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), PythReceiverError::InvalidUpdateData));
    }

    #[test]
    fn test_invalid_wormhole_vaa() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);
        
        let invalid_vaa_data = create_invalid_vaa_data();
        let result = contract.update_price_feeds_internal(
            invalid_vaa_data,
            vec![],
            0,
            u64::MAX,
            false
        );
        
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_merkle_proof() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);
        
        let invalid_merkle_data = create_invalid_merkle_data();
        let result = contract.update_price_feeds_internal(
            invalid_merkle_data,
            vec![],
            0,
            u64::MAX,
            false
        );
        
        assert!(result.is_err());
    }

    #[test]
    fn test_stale_price_rejection() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);
        
        let test_price_id = [1u8; 32];
        let price_result = contract.get_price_unsafe(test_price_id);
        assert!(price_result.is_err());
        assert!(matches!(price_result.unwrap_err(), PythReceiverError::PriceUnavailable));
        
    }

    #[test]
    fn test_get_price_no_older_than_error() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);
        
        let test_price_id = [1u8; 32];
        let result = contract.get_price_no_older_than(test_price_id, 1);
        
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), PythReceiverError::PriceUnavailable));
        
    }

    #[test]
    fn test_contract_state_after_init() {
        let vm = TestVM::default();
        let contract = initialize_test_contract(&vm);
        
        let fee = contract.get_update_fee(vec![]);
        assert_eq!(fee, U256::from(0u8));
        
        let random_price_id = [42u8; 32];
        let price_result = contract.get_price_unsafe(random_price_id);
        assert!(price_result.is_err());
        
        let price_no_older_result = contract.get_price_no_older_than(random_price_id, 3600);
        assert!(price_no_older_result.is_err());
    }
}
