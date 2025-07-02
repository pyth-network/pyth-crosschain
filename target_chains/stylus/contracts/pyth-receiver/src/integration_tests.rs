
#[cfg(test)]
mod test {
    use crate::PythReceiver;
    use crate::error::PythReceiverError;
    use crate::test_data;
    use alloy_primitives::{address, U256, Address};
    use stylus_sdk::testing::TestVM;
    use pythnet_sdk::wire::v1::PYTHNET_ACCUMULATOR_UPDATE_MAGIC;
    use motsu::prelude::*;
    use wormhole_contract::WormholeContract;

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

    const CHAIN_ID: u16 = 60051;
    const GOVERNANCE_CHAIN_ID: u16 = 1;
    const GOVERNANCE_CONTRACT: U256 = U256::from_limbs([4, 0, 0, 0]);

    fn initialize_test_contract(vm: &TestVM) -> PythReceiver {
        let mut contract = PythReceiver::from(vm);
        let wormhole_address = address!("0x395921b642ba511d421ae834fef56ac886735ca2");
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
        test_data::good_update1()
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

    // #[test]
    // fn test_initialize() {
    //     let vm = TestVM::default();
    //     let mut contract = PythReceiver::from(&vm);

    //     let wormhole_address = address!("0x3F38404A2e3Cb949bcDfA19a5C3bDf3fE375fEb0");
    //     let single_update_fee = U256::from(100u64);
    //     let valid_time_period = U256::from(3600u64);

    //     let data_source_chain_ids = vec![PYTHNET_CHAIN_ID];
    //     let data_source_emitter_addresses = vec![PYTHNET_EMITTER_ADDRESS];

    //     let governance_chain_id = 1u16;
    //     let governance_emitter_address = [3u8; 32];
    //     let governance_initial_sequence = 0u64;
    //     let data = vec![];

    //     contract.initialize(
    //         wormhole_address,
    //         single_update_fee,
    //         valid_time_period,
    //         data_source_chain_ids.clone(),
    //         data_source_emitter_addresses.clone(),
    //         governance_chain_id,
    //         governance_emitter_address,
    //         governance_initial_sequence,
    //         data,
    //     );

    //     let fee = contract.get_update_fee(vec![]);
    //     assert_eq!(fee, U256::from(0u8)); // Fee calculation not implemented yet

    //     let twap_fee = contract.get_twap_update_fee(vec![]);
    //     assert_eq!(twap_fee, U256::from(0u8)); // Fee calculation not implemented yet

    //     let test_price_id = TEST_PRICE_ID;
    //     let price_result = contract.get_price_unsafe(test_price_id);
    //     assert!(price_result.is_err());
    //     assert!(matches!(price_result.unwrap_err(), PythReceiverError::PriceUnavailable));
    // }

    // #[test]
    // fn test_update_new_price_feed() {
    //     let vm = TestVM::default();
    //     let mut contract = initialize_test_contract(&vm);

    //     let test_price_id = TEST_PRICE_ID;

    //     let update_data = test_data::good_update1();
    //     let _result = contract.update_price_feeds(update_data);


    //     let price_result = contract.get_price_unsafe(test_price_id);
    //     assert!(price_result.is_err());
    //     assert!(matches!(price_result.unwrap_err(), PythReceiverError::PriceUnavailable));
    // }

    // #[test]
    // fn test_update_existing_price_feed() {
    //     let vm = TestVM::default();
    //     let mut contract = initialize_test_contract(&vm);

    //     let _test_price_id = TEST_PRICE_ID;

    //     let update_data1 = create_valid_update_data();
    //     let _result1 = contract.update_price_feeds(update_data1);

    //     let update_data2 = create_valid_update_data();
    //     let _result2 = contract.update_price_feeds(update_data2);

    // }

    // #[test]
    // fn test_invalid_magic_header() {
    //     let vm = TestVM::default();
    //     let mut contract = initialize_test_contract(&vm);

    //     let invalid_data = create_invalid_magic_data();
    //     let result = contract.update_price_feeds(invalid_data);

    //     assert!(result.is_err());
    //     assert!(matches!(result.unwrap_err(), PythReceiverError::InvalidAccumulatorMessage));
    // }

    // #[test]
    // fn test_invalid_wire_format() {
    //     let vm = TestVM::default();
    //     let mut contract = initialize_test_contract(&vm);

    //     let short_data = create_short_data();
    //     let result = contract.update_price_feeds(short_data);

    //     assert!(result.is_err());
    //     assert!(matches!(result.unwrap_err(), PythReceiverError::InvalidUpdateData));
    // }

    // #[test]
    // fn test_invalid_wormhole_vaa() {
    //     let vm = TestVM::default();
    //     let mut contract = initialize_test_contract(&vm);

    //     let invalid_vaa_data = create_invalid_vaa_data();
    //     let result = contract.update_price_feeds(invalid_vaa_data);

    //     assert!(result.is_err());
    // }

    // #[test]
    // fn test_invalid_merkle_proof() {
    //     let vm = TestVM::default();
    //     let mut contract = initialize_test_contract(&vm);

    //     let invalid_merkle_data = create_invalid_merkle_data();
    //     let result = contract.update_price_feeds(invalid_merkle_data);

    //     assert!(result.is_err());
    // }

    // #[test]
    // fn test_stale_price_rejection() {
    //     let vm = TestVM::default();
    //     let contract = initialize_test_contract(&vm);

    //     let test_price_id = TEST_PRICE_ID;
    //     let price_result = contract.get_price_unsafe(test_price_id);
    //     assert!(price_result.is_err());
    //     assert!(matches!(price_result.unwrap_err(), PythReceiverError::PriceUnavailable));

    // }

    // #[test]
    // fn test_get_price_no_older_than_error() {
    //     let vm = TestVM::default();
    //     let contract = initialize_test_contract(&vm);

    //     let test_price_id = TEST_PRICE_ID;
    //     let result = contract.get_price_no_older_than(test_price_id, 1);

    //     assert!(result.is_err());
    //     assert!(matches!(result.unwrap_err(), PythReceiverError::PriceUnavailable));

    // }

    // #[test]
    // fn test_contract_state_after_init() {
    //     let vm = TestVM::default();
    //     let contract = initialize_test_contract(&vm);

    //     let fee = contract.get_update_fee(vec![]);
    //     assert_eq!(fee, U256::from(0u8));

    //     let random_price_id = TEST_PRICE_ID;
    //     let price_result = contract.get_price_unsafe(random_price_id);
    //     assert!(price_result.is_err());

    //     let price_no_older_result = contract.get_price_no_older_than(random_price_id, 3600);
    //     assert!(price_no_older_result.is_err());
    // }

    // #[test]
    // fn test_successful_price_update_and_retrieval() {
    //     let vm = TestVM::default();
    //     let contract = initialize_test_contract(&vm);

    //     let initial_result = contract.get_price_unsafe(TEST_PRICE_ID);
    //     assert!(initial_result.is_err());
    //     assert!(matches!(initial_result.unwrap_err(), PythReceiverError::PriceUnavailable));

    // }

    // #[test]
    // fn test_realistic_test_data_functions() {
    //     let good_update_data = test_data::good_update1();
    //     assert!(!good_update_data.is_empty());
    //     assert!(good_update_data.len() > 100);

    //     let vaa_data = test_data::good_vm1();
    //     assert!(!vaa_data.is_empty());
    //     assert!(vaa_data.len() > 50);

    //     let price_update_data = test_data::test_price_update1();
    //     assert!(!price_update_data.is_empty());
    //     assert!(price_update_data.len() > 100);

    //     let price_update2_data = test_data::test_price_update2();
    //     assert!(!price_update2_data.is_empty());
    //     assert!(price_update2_data.len() > 100);
    // }

    #[cfg(test)]
    fn current_guardians() -> Vec<Address> {
        vec![
            Address::from([0x58, 0x93, 0xB5, 0xA7, 0x6c, 0x3f, 0x73, 0x96, 0x45, 0x64, 0x88, 0x85, 0xBD, 0xCC, 0x06, 0xcd, 0x70, 0xa3, 0xCd, 0x3]), // Rockaway
            Address::from([0xfF, 0x6C, 0xB9, 0x52, 0x58, 0x9B, 0xDE, 0x86, 0x2c, 0x25, 0xEf, 0x43, 0x92, 0x13, 0x2f, 0xb9, 0xD4, 0xA4, 0x21, 0x57]), // Staked
            Address::from([0x11, 0x4D, 0xe8, 0x46, 0x01, 0x93, 0xbd, 0xf3, 0xA2, 0xfC, 0xf8, 0x1f, 0x86, 0xa0, 0x97, 0x65, 0xF4, 0x76, 0x2f, 0xD1]), // Figment
            Address::from([0x10, 0x7A, 0x00, 0x86, 0xb3, 0x2d, 0x7A, 0x09, 0x77, 0x92, 0x6A, 0x20, 0x51, 0x31, 0xd8, 0x73, 0x1D, 0x39, 0xcb, 0xEB]), // ChainodeTech
            Address::from([0x8C, 0x82, 0xB2, 0xfd, 0x82, 0xFa, 0xeD, 0x27, 0x11, 0xd5, 0x9A, 0xF0, 0xF2, 0x49, 0x9D, 0x16, 0xe7, 0x26, 0xf6, 0xb2]), // Inotel
            Address::from([0x11, 0xb3, 0x97, 0x56, 0xC0, 0x42, 0x44, 0x1B, 0xE6, 0xD8, 0x65, 0x0b, 0x69, 0xb5, 0x4E, 0xBE, 0x71, 0x5E, 0x23, 0x43]), // HashKey Cloud
            Address::from([0x54, 0xCe, 0x5B, 0x4D, 0x34, 0x8f, 0xb7, 0x4B, 0x95, 0x8e, 0x89, 0x66, 0xe2, 0xec, 0x3d, 0xBd, 0x49, 0x58, 0xa7, 0xcd]), // ChainLayer
            Address::from([0x15, 0xe7, 0xcA, 0xF0, 0x7C, 0x4e, 0x3D, 0xC8, 0xe7, 0xC4, 0x69, 0xf9, 0x2C, 0x8C, 0xd8, 0x8F, 0xB8, 0x00, 0x5a, 0x20]), // xLabs
            Address::from([0x74, 0xa3, 0xbf, 0x91, 0x39, 0x53, 0xD6, 0x95, 0x26, 0x0D, 0x88, 0xBC, 0x1a, 0xA2, 0x5A, 0x4e, 0xeE, 0x36, 0x3e, 0xf0]), // Forbole
            Address::from([0x00, 0x0a, 0xC0, 0x07, 0x67, 0x27, 0xb3, 0x5F, 0xBe, 0xa2, 0xdA, 0xc2, 0x8f, 0xEE, 0x5c, 0xCB, 0x0f, 0xEA, 0x76, 0x8e]), // Staking Fund
            Address::from([0xAF, 0x45, 0xCe, 0xd1, 0x36, 0xb9, 0xD9, 0xe2, 0x49, 0x03, 0x46, 0x4A, 0xE8, 0x89, 0xF5, 0xC8, 0xa7, 0x23, 0xFC, 0x14]), // Moonlet Wallet
            Address::from([0xf9, 0x31, 0x24, 0xb7, 0xc7, 0x38, 0x84, 0x3C, 0xBB, 0x89, 0xE8, 0x64, 0xc8, 0x62, 0xc3, 0x8c, 0xdd, 0xCc, 0xF9, 0x5]), // P2P Validator
            Address::from([0xD2, 0xCC, 0x37, 0xA4, 0xdc, 0x03, 0x6a, 0x8D, 0x23, 0x2b, 0x48, 0xf6, 0x2c, 0xDD, 0x47, 0x31, 0x41, 0x2f, 0x48, 0x90]), // 01node
            Address::from([0xDA, 0x79, 0x8F, 0x68, 0x96, 0xA3, 0x33, 0x1F, 0x64, 0xb4, 0x8c, 0x12, 0xD1, 0xD5, 0x7F, 0xd9, 0xcb, 0xe7, 0x08, 0x11]), // MCF
            Address::from([0x71, 0xAA, 0x1B, 0xE1, 0xD3, 0x6C, 0xaF, 0xE3, 0x86, 0x79, 0x10, 0xF9, 0x9C, 0x09, 0xe3, 0x47, 0x89, 0x9C, 0x19, 0xC3]), // Everstake
            Address::from([0x81, 0x92, 0xb6, 0xE7, 0x38, 0x7C, 0xCd, 0x76, 0x82, 0x77, 0xc1, 0x7D, 0xAb, 0x1b, 0x7a, 0x50, 0x27, 0xc0, 0xb3, 0xCf]), // Chorus One
            Address::from([0x17, 0x8e, 0x21, 0xad, 0x2E, 0x77, 0xAE, 0x06, 0x71, 0x15, 0x49, 0xCF, 0xBB, 0x1f, 0x9c, 0x7a, 0x9d, 0x80, 0x96, 0xe8]), // Syncnode
            Address::from([0x5E, 0x14, 0x87, 0xF3, 0x55, 0x15, 0xd0, 0x2A, 0x92, 0x75, 0x35, 0x04, 0xa8, 0xD7, 0x54, 0x71, 0xb9, 0xf4, 0x9E, 0xdB]), // Triton
            Address::from([0x6F, 0xBc, 0x89, 0x8F, 0x40, 0x3E, 0x47, 0x73, 0xE9, 0x5f, 0xeb, 0x15, 0xE8, 0x0C, 0x9A, 0x99, 0x9C, 0x83, 0x48, 0xd]), // Staking Facilities
            // Address::from_str("0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3").unwrap(), // Rockaway
            // Address::from_str("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157").unwrap(), // Staked
            // Address::from_str("0x114De8460193bdf3A2fCf81f86a09765F4762fD1").unwrap(), // Figment
            // Address::from_str("0x107A0086b32d7A0977926A205131d8731D39cbEB").unwrap(), // ChainodeTech
            // Address::from_str("0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2").unwrap(), // Inotel
            // Address::from_str("0x11b39756C042441BE6D8650b69b54EbE715E2343").unwrap(), // HashKey Cloud
            // Address::from_str("0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd").unwrap(), // ChainLayer
            // Address::from_str("0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20").unwrap(), // xLabs
            // Address::from_str("0x74a3bf913953D695260D88BC1aA25A4eeE363ef0").unwrap(), // Forbole
            // Address::from_str("0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e").unwrap(), // Staking Fund
            // Address::from_str("0xAF45Ced136b9D9e24903464AE889F5C8a723FC14").unwrap(), // Moonlet Wallet
            // Address::from_str("0xf93124b7c738843CBB89E864c862c38cddCccF95").unwrap(), // P2P Validator
            // Address::from_str("0xD2CC37A4dc036a8D232b48f62cDD4731412f4890").unwrap(), // 01node
            // Address::from_str("0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811").unwrap(), // MCF
            // Address::from_str("0x71AA1BE1D36CaFE3867910F99C09e347899C19C3").unwrap(), // Everstake
            // Address::from_str("0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf").unwrap(), // Chorus One
            // Address::from_str("0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8").unwrap(), // Syncnode
            // Address::from_str("0x5E1487F35515d02A92753504a8D75471b9f49EdB").unwrap(), // Triton
            // Address::from_str("0x6FbEBc898F403E4773E95feB15E80C9A99c8348d").unwrap(), // Staking Facilities
        ]
    }

    #[motsu::test]
    fn e2e_valid_test(pyth_contract: Contract<PythReceiver>, wormhole_contract: Contract<WormholeContract>, alice: Address) {
        let guardians = current_guardians();
        let governance_contract = Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract.sender(alice).initialize(guardians, CHAIN_ID, GOVERNANCE_CHAIN_ID, governance_contract).unwrap();
        // let result = wormhole_contract.sender(alice).store_gs(4, current_guardians(), 0);

        let single_update_fee = U256::from(100u64);
        let valid_time_period = U256::from(3600u64);

        let data_source_chain_ids = vec![PYTHNET_CHAIN_ID];
        let data_source_emitter_addresses = vec![PYTHNET_EMITTER_ADDRESS];

        let governance_chain_id = 1u16;
        let governance_emitter_address = [3u8; 32];
        let governance_initial_sequence = 0u64;
        let data = vec![];

        pyth_contract.sender(alice).initialize(
            wormhole_contract.address(),
            single_update_fee,
            valid_time_period,
            data_source_chain_ids,
            data_source_emitter_addresses,
            governance_chain_id,
            governance_emitter_address,
            governance_initial_sequence,
            data,
        );
        
        // let update_data = test_data::good_update1();

        // let result = pyth_contract.sender(alice).update_price_feeds(update_data);
        // assert!(result.is_ok());

        // let price_result = pyth_contract.sender(alice).get_price_unsafe(TEST_PRICE_ID);
        // assert!(price_result.is_ok());
        // assert_eq!(price_result.unwrap(), (TEST_PUBLISH_TIME, TEST_EXPO, TEST_PRICE, TEST_CONF, TEST_EMA_PRICE, TEST_EMA_CONF));
        
        
    }
}
