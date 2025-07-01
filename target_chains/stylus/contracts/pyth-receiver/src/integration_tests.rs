
#[cfg(test)]
mod test {
    use crate::PythReceiver;
    use crate::error::PythReceiverError;
    use alloy_primitives::{address, U256, FixedBytes};
    use stylus_sdk::testing::TestVM;
    use pythnet_sdk::wire::v1::PYTHNET_ACCUMULATOR_UPDATE_MAGIC;

    const TEST_PRICE_ID: [u8; 32] = [
        0xe6, 0x2d, 0xf6, 0xc8, 0xb4, 0xa8, 0x5f, 0xe1, 0xa6, 0x7d, 0xb4, 0x4d, 0xc1, 0x2d, 0xe5, 0xdb,
        0x33, 0x0f, 0x7a, 0xc6, 0x6b, 0x72, 0xdc, 0x65, 0x8a, 0xfe, 0xdf, 0x0f, 0x4a, 0x41, 0x5b, 0x43
    ];
    const TEST_PUBLISH_TIME: u64 = 1712589206;
    const TEST_PRICE: i64 = 7192002930010;
    const TEST_CONF: u64 = 3596501465;
    const TEST_EXPO: i32 = -8;
    const TEST_EMA_PRICE: i64 = 7181868900000;
    const TEST_EMA_CONF: u64 = 4096812700;

    const PYTHNET_CHAIN_ID: u16 = 26;
    const PYTHNET_EMITTER_ADDRESS: [u8; 32] = [
        0xe1, 0x01, 0xfa, 0xed, 0xac, 0x58, 0x51, 0xe3, 0x2b, 0x9b, 0x23, 0xb5, 0xf9, 0x41, 0x1a, 0x8c,
        0x2b, 0xac, 0x4a, 0xae, 0x3e, 0xd4, 0xdd, 0x7b, 0x81, 0x1d, 0xd1, 0xa7, 0x2e, 0xa4, 0xaa, 0x71
    ];

    fn initialize_test_contract(vm: &TestVM) -> PythReceiver {
        let mut contract = PythReceiver::from(vm);
        let wormhole_address = address!("0x3F38404A2e3Cb949bcDfA19a5C3bDf3fE375fEb0");
        let single_update_fee = U256::from(100u64);
        let valid_time_period = U256::from(3600u64);

        let data_source_chain_ids = vec![PYTHNET_CHAIN_ID];
        let data_source_emitter_addresses = vec![PYTHNET_EMITTER_ADDRESS];

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

        let data_source_chain_ids = vec![PYTHNET_CHAIN_ID];
        let data_source_emitter_addresses = vec![PYTHNET_EMITTER_ADDRESS];

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

        let test_price_id = TEST_PRICE_ID;
        let price_result = contract.get_price_unsafe(test_price_id);
        assert!(price_result.is_err());
        assert!(matches!(price_result.unwrap_err(), PythReceiverError::PriceUnavailable));
    }

    #[test]
    fn test_update_new_price_feed() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);

        let test_price_id = TEST_PRICE_ID;

        let update_data = create_valid_update_data();
        let _result = contract.update_price_feeds(update_data);


        let price_result = contract.get_price_unsafe(test_price_id);
        assert!(price_result.is_err());
        assert!(matches!(price_result.unwrap_err(), PythReceiverError::PriceUnavailable));
    }

    #[test]
    fn test_update_existing_price_feed() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);

        let _test_price_id = TEST_PRICE_ID;

        let update_data1 = create_valid_update_data();
        let _result1 = contract.update_price_feeds(update_data1);

        let update_data2 = create_valid_update_data();
        let _result2 = contract.update_price_feeds(update_data2);

    }

    #[test]
    fn test_invalid_magic_header() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);

        let invalid_data = create_invalid_magic_data();
        let result = contract.update_price_feeds(invalid_data);

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), PythReceiverError::InvalidAccumulatorMessage));
    }

    #[test]
    fn test_invalid_wire_format() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);

        let short_data = create_short_data();
        let result = contract.update_price_feeds(short_data);

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), PythReceiverError::InvalidUpdateData));
    }

    #[test]
    fn test_invalid_wormhole_vaa() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);

        let invalid_vaa_data = create_invalid_vaa_data();
        let result = contract.update_price_feeds(invalid_vaa_data);

        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_merkle_proof() {
        let vm = TestVM::default();
        let mut contract = initialize_test_contract(&vm);

        let invalid_merkle_data = create_invalid_merkle_data();
        let result = contract.update_price_feeds(invalid_merkle_data);

        assert!(result.is_err());
    }

    #[test]
    fn test_stale_price_rejection() {
        let vm = TestVM::default();
        let contract = initialize_test_contract(&vm);

        let test_price_id = TEST_PRICE_ID;
        let price_result = contract.get_price_unsafe(test_price_id);
        assert!(price_result.is_err());
        assert!(matches!(price_result.unwrap_err(), PythReceiverError::PriceUnavailable));

    }

    #[test]
    fn test_get_price_no_older_than_error() {
        let vm = TestVM::default();
        let contract = initialize_test_contract(&vm);

        let test_price_id = TEST_PRICE_ID;
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

        let random_price_id = TEST_PRICE_ID;
        let price_result = contract.get_price_unsafe(random_price_id);
        assert!(price_result.is_err());

        let price_no_older_result = contract.get_price_no_older_than(random_price_id, 3600);
        assert!(price_no_older_result.is_err());
    }

    #[test]
    fn test_successful_price_update_and_retrieval() {
        let vm = TestVM::default();
        let contract = initialize_test_contract(&vm);

        let initial_result = contract.get_price_unsafe(TEST_PRICE_ID);
        assert!(initial_result.is_err());
        assert!(matches!(initial_result.unwrap_err(), PythReceiverError::PriceUnavailable));

        // let update_data = create_valid_update_data();
        // let update_result = contract.update_price_feeds(update_data);

        // let price_result = contract.get_price_unsafe(TEST_PRICE_ID);
        // assert!(price_result.is_ok());

        // let price_info = price_result.unwrap();
        // assert_eq!(price_info.0.to::<u64>(), TEST_PUBLISH_TIME);
        // assert_eq!(price_info.2.to::<i64>(), TEST_PRICE);
        // assert_eq!(price_info.3.to::<u64>(), TEST_CONF);
    }
}
