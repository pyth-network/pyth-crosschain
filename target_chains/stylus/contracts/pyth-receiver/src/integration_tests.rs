#[cfg(test)]
mod test {
    use crate::error::PythReceiverError;
    use crate::test_data;
    use crate::PythReceiver;
    use alloy_primitives::{address, Address, I32, I64, U256, U64};
    use motsu::prelude::*;
    use wormhole_contract::WormholeContract;
    const TEST_PRICE_ID: [u8; 32] = [
        0xe6, 0x2d, 0xf6, 0xc8, 0xb4, 0xa8, 0x5f, 0xe1, 0xa6, 0x7d, 0xb4, 0x4d, 0xc1, 0x2d, 0xe5,
        0xdb, 0x33, 0x0f, 0x7a, 0xc6, 0x6b, 0x72, 0xdc, 0x65, 0x8a, 0xfe, 0xdf, 0x0f, 0x4a, 0x41,
        0x5b, 0x43,
    ];
    const TEST_PUBLISH_TIME: u64 = 1751563000;
    const TEST_PRICE: i64 = 10967241867779;
    const TEST_CONF: u64 = 4971244966;
    const TEST_EXPO: i32 = -8;
    const TEST_EMA_PRICE: i64 = 10942391100000;
    const TEST_EMA_CONF: u64 = 4398561400;

    const PYTHNET_CHAIN_ID: u16 = 26;
    const PYTHNET_EMITTER_ADDRESS: [u8; 32] = [
        0xe1, 0x01, 0xfa, 0xed, 0xac, 0x58, 0x51, 0xe3, 0x2b, 0x9b, 0x23, 0xb5, 0xf9, 0x41, 0x1a,
        0x8c, 0x2b, 0xac, 0x4a, 0xae, 0x3e, 0xd4, 0xdd, 0x7b, 0x81, 0x1d, 0xd1, 0xa7, 0x2e, 0xa4,
        0xaa, 0x71,
    ];

    const CHAIN_ID: u16 = 60051;
    const GOVERNANCE_CHAIN_ID: u16 = 1;
    const GOVERNANCE_CONTRACT: U256 = U256::from_limbs([4, 0, 0, 0]);

    #[cfg(test)]
    fn current_guardians() -> Vec<Address> {
        vec![
            address!("0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3"), // Rockaway
            address!("0xfF6CB952589BDE862c25Ef4392132fb9D4A42157"), // Staked
            address!("0x114De8460193bdf3A2fCf81f86a09765F4762fD1"), // Figment
            address!("0x107A0086b32d7A0977926A205131d8731D39cbEB"), // ChainodeTech
            address!("0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2"), // Inotel
            address!("0x11b39756C042441BE6D8650b69b54EbE715E2343"), // HashKey Cloud
            address!("0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd"), // ChainLayer
            address!("0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20"), // xLabs
            address!("0x74a3bf913953D695260D88BC1aA25A4eeE363ef0"), // Forbole
            address!("0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e"), // Staking Fund
            address!("0xAF45Ced136b9D9e24903464AE889F5C8a723FC14"), // Moonlet Wallet
            address!("0xf93124b7c738843CBB89E864c862c38cddCccF95"), // P2P Validator
            address!("0xD2CC37A4dc036a8D232b48f62cDD4731412f4890"), // 01node
            address!("0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811"), // MCF
            address!("0x71AA1BE1D36CaFE3867910F99C09e347899C19C3"), // Everstake
            address!("0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf"), // Chorus One
            address!("0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8"), // Syncnode
            address!("0x5E1487F35515d02A92753504a8D75471b9f49EdB"), // Triton
            address!("0x6FbEBc898F403E4773E95feB15E80C9A99c8348d"), // Staking Facilities
        ]
    }

    #[motsu::test]
    fn e2e_valid_test(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let guardians = current_guardians();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract
            .sender(alice)
            .initialize(
                guardians,
                4,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();
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

        alice.fund(U256::from(200));

        let update_data = test_data::good_update1();

        let result = pyth_contract
            .sender_and_value(alice, U256::from(100))
            .update_price_feeds(update_data);
        assert!(result.is_ok());

        let price_result = pyth_contract.sender(alice).get_price_unsafe(TEST_PRICE_ID);
        assert!(price_result.is_ok());
        assert_eq!(
            price_result.unwrap(),
            (
                U64::from(TEST_PUBLISH_TIME),
                I32::from_le_bytes(TEST_EXPO.to_le_bytes()),
                I64::from_le_bytes(TEST_PRICE.to_le_bytes()),
                U64::from(TEST_CONF),
                I64::from_le_bytes(TEST_EMA_PRICE.to_le_bytes()),
                U64::from(TEST_EMA_CONF)
            )
        );
    }

    #[motsu::test]
    fn test_update_price_feed_insufficient_fee(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let guardians = current_guardians();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract
            .sender(alice)
            .initialize(
                guardians,
                4,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();
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

        alice.fund(U256::from(50));

        let update_data = test_data::good_update1();

        let result = pyth_contract
            .sender_and_value(alice, U256::from(50))
            .update_price_feeds(update_data);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), PythReceiverError::InsufficientFee);
    }

    #[motsu::test]
    fn test_get_price_after_multiple_updates(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let guardians = current_guardians();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract
            .sender(alice)
            .initialize(
                guardians,
                4,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();

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

        alice.fund(U256::from(200));

        let update_data1 = test_data::good_update1();
        let result1 = pyth_contract
            .sender_and_value(alice, U256::from(100))
            .update_price_feeds(update_data1);
        assert!(result1.is_ok());

        let update_data2 = test_data::good_update2();
        let result2 = pyth_contract
            .sender_and_value(alice, U256::from(100))
            .update_price_feeds(update_data2);
        assert!(result2.is_ok());

        let price_result = pyth_contract.sender(alice).get_price_unsafe(TEST_PRICE_ID);
        assert!(price_result.is_ok());
        assert_eq!(
            price_result.unwrap(),
            (
                U64::from(1751573860u64),
                I32::from_le_bytes((-8i32).to_le_bytes()),
                I64::from_le_bytes(10985663592646i64.to_le_bytes()),
                U64::from(4569386330u64),
                I64::from_le_bytes(10977795800000i64.to_le_bytes()),
                U64::from(3919318300u64)
            )
        );
    }

    #[motsu::test]
    fn test_get_price_unavailable_no_update(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let guardians = current_guardians();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract
            .sender(alice)
            .initialize(
                guardians,
                4,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();

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

        let price_result = pyth_contract.sender(alice).get_price_unsafe(TEST_PRICE_ID);
        assert!(price_result.is_err());
        assert_eq!(
            price_result.unwrap_err(),
            PythReceiverError::PriceUnavailable
        );
    }

    #[motsu::test]
    fn test_get_price_no_older_than_unavailable_random_id(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let guardians = current_guardians();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract
            .sender(alice)
            .initialize(
                guardians,
                4,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();

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

        let random_id: [u8; 32] = [
            0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc,
            0xde, 0xf0, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x12, 0x34, 0x56, 0x78,
            0x9a, 0xbc, 0xde, 0xf0,
        ];

        let price_result = pyth_contract
            .sender(alice)
            .get_price_no_older_than(random_id, 3600);
        assert!(price_result.is_err());
        assert_eq!(
            price_result.unwrap_err(),
            PythReceiverError::PriceUnavailable
        );
    }

    #[motsu::test]
    fn test_get_price_no_older_than_valid_max_age(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let guardians = current_guardians();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract
            .sender(alice)
            .initialize(
                guardians,
                4,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();

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

        alice.fund(U256::from(200));

        let update_data = test_data::good_update2();
        let result = pyth_contract
            .sender_and_value(alice, U256::from(100))
            .update_price_feeds(update_data);
        assert!(result.is_ok());

        let price_result = pyth_contract
            .sender(alice)
            .get_price_no_older_than(TEST_PRICE_ID, u64::MAX);
        assert!(price_result.is_ok());
        assert_eq!(
            price_result.unwrap(),
            (
                U64::from(1751573860u64),
                I32::from_le_bytes((-8i32).to_le_bytes()),
                I64::from_le_bytes(10985663592646i64.to_le_bytes()),
                U64::from(4569386330u64),
                I64::from_le_bytes(10977795800000i64.to_le_bytes()),
                U64::from(3919318300u64)
            )
        );
    }

    #[motsu::test]
    fn test_get_price_no_older_than_too_old(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let guardians = current_guardians();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract
            .sender(alice)
            .initialize(
                guardians,
                4,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();

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
        alice.fund(U256::from(200));

        let update_data = test_data::good_update2();
        let result = pyth_contract
            .sender_and_value(alice, U256::from(100))
            .update_price_feeds(update_data);
        assert!(result.is_ok());

        let price_result = pyth_contract
            .sender(alice)
            .get_price_no_older_than(TEST_PRICE_ID, 1);
        assert!(price_result.is_err());
        assert_eq!(
            price_result.unwrap_err(),
            PythReceiverError::NewPriceUnavailable
        );
    }

    #[motsu::test]
    fn test_multiple_updates_both_ids(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let guardians = current_guardians();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract
            .sender(alice)
            .initialize(
                guardians,
                4,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();

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

        alice.fund(U256::from(200));

        let update_data = test_data::multiple_updates();
        let result = pyth_contract
            .sender_and_value(alice, U256::from(200))
            .update_price_feeds(update_data);
        assert!(result.is_ok());

        let first_id: [u8; 32] = [
            0xe6, 0x2d, 0xf6, 0xc8, 0xb4, 0xa8, 0x5f, 0xe1, 0xa6, 0x7d, 0xb4, 0x4d, 0xc1, 0x2d,
            0xe5, 0xdb, 0x33, 0x0f, 0x7a, 0xc6, 0x6b, 0x72, 0xdc, 0x65, 0x8a, 0xfe, 0xdf, 0x0f,
            0x4a, 0x41, 0x5b, 0x43,
        ];
        let second_id: [u8; 32] = [
            0xff, 0x61, 0x49, 0x1a, 0x93, 0x11, 0x12, 0xdd, 0xf1, 0xbd, 0x81, 0x47, 0xcd, 0x1b,
            0x64, 0x13, 0x75, 0xf7, 0x9f, 0x58, 0x25, 0x12, 0x6d, 0x66, 0x54, 0x80, 0x87, 0x46,
            0x34, 0xfd, 0x0a, 0xce,
        ];

        let first_price_result = pyth_contract.sender(alice).get_price_unsafe(first_id);
        assert!(first_price_result.is_ok());
        assert_eq!(
            first_price_result.unwrap(),
            (
                U64::from(1751573123u64),
                I32::from_le_bytes((-8i32).to_le_bytes()),
                I64::from_le_bytes(10990356724259i64.to_le_bytes()),
                U64::from(3891724259u64),
                I64::from_le_bytes(10974970400000i64.to_le_bytes()),
                U64::from(3918344000u64)
            )
        );

        let second_price_result = pyth_contract.sender(alice).get_price_unsafe(second_id);
        assert!(second_price_result.is_ok());
        assert_eq!(
            second_price_result.unwrap(),
            (
                U64::from(1751573123u64),
                I32::from_le_bytes((-8i32).to_le_bytes()),
                I64::from_le_bytes(258906787480i64.to_le_bytes()),
                U64::from(158498649u64),
                I64::from_le_bytes(258597182000i64.to_le_bytes()),
                U64::from(131285914u64)
            )
        );
    }
}
