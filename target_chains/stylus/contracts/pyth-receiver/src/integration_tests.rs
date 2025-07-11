#[cfg(test)]
mod test {
    use crate::error::PythReceiverError;
    use crate::test_data::*;
    use crate::PythReceiver;
    use alloy_primitives::{Address, U256};
    use mock_instant::global::MockClock;
    use motsu::prelude::*;
    use pythnet_sdk::wire::v1::{AccumulatorUpdateData, Proof};
    use std::time::Duration;
    use wormhole_contract::WormholeContract;
    const TEST_PRICE_ID: [u8; 32] = [
        0xe6, 0x2d, 0xf6, 0xc8, 0xb4, 0xa8, 0x5f, 0xe1, 0xa6, 0x7d, 0xb4, 0x4d, 0xc1, 0x2d, 0xe5,
        0xdb, 0x33, 0x0f, 0x7a, 0xc6, 0x6b, 0x72, 0xdc, 0x65, 0x8a, 0xfe, 0xdf, 0x0f, 0x4a, 0x41,
        0x5b, 0x43,
    ];

    const PYTHNET_CHAIN_ID: u16 = 26;
    const PYTHNET_EMITTER_ADDRESS: [u8; 32] = [
        0xe1, 0x01, 0xfa, 0xed, 0xac, 0x58, 0x51, 0xe3, 0x2b, 0x9b, 0x23, 0xb5, 0xf9, 0x41, 0x1a,
        0x8c, 0x2b, 0xac, 0x4a, 0xae, 0x3e, 0xd4, 0xdd, 0x7b, 0x81, 0x1d, 0xd1, 0xa7, 0x2e, 0xa4,
        0xaa, 0x71,
    ];

    const CHAIN_ID: u16 = 60051;
    const GOVERNANCE_CHAIN_ID: u16 = 1;
    const GOVERNANCE_CONTRACT: U256 = U256::from_limbs([4, 0, 0, 0]);

    const SINGLE_UPDATE_FEE_IN_WEI: U256 = U256::from_limbs([100, 0, 0, 0]);
    const TRANSACTION_FEE_IN_WEI: U256 = U256::from_limbs([32, 0, 0, 0]);

    #[cfg(test)]
    fn mock_get_update_fee(update_data: Vec<Vec<u8>>) -> Result<U256, PythReceiverError> {
        let mut total_num_updates: u64 = 0;
        for data in &update_data {
            let update_data_array: &[u8] = &data;
            let accumulator_update = AccumulatorUpdateData::try_from_slice(&update_data_array)
                .map_err(|_| PythReceiverError::InvalidAccumulatorMessage)?;
            match accumulator_update.proof {
                Proof::WormholeMerkle { vaa: _, updates } => {
                    let num_updates = u64::try_from(updates.len())
                        .map_err(|_| PythReceiverError::TooManyUpdates)?;
                    total_num_updates += num_updates;
                }
            }
        }
        Ok(get_total_fee(total_num_updates))
    }

    fn get_total_fee(total_num_updates: u64) -> U256 {
        U256::from(total_num_updates).saturating_mul(SINGLE_UPDATE_FEE_IN_WEI)
            + TRANSACTION_FEE_IN_WEI
    }

    #[cfg(test)]
    fn pyth_wormhole_init(
        pyth_contract: &Contract<PythReceiver>,
        wormhole_contract: &Contract<WormholeContract>,
        alice: &Address,
    ) {
        let guardians = current_guardians();
        let governance_contract =
            Address::from_slice(&GOVERNANCE_CONTRACT.to_be_bytes::<32>()[12..32]);
        wormhole_contract
            .sender(*alice)
            .initialize(
                guardians,
                4,
                CHAIN_ID,
                GOVERNANCE_CHAIN_ID,
                governance_contract,
            )
            .unwrap();

        let single_update_fee = SINGLE_UPDATE_FEE_IN_WEI;
        let valid_time_period = U256::from(3600u64);

        let data_source_chain_ids = vec![PYTHNET_CHAIN_ID];
        let data_source_emitter_addresses = vec![PYTHNET_EMITTER_ADDRESS];

        let governance_chain_id = 1u16;
        let governance_emitter_address = [3u8; 32];
        let governance_initial_sequence = 0u64;

        pyth_contract.sender(*alice).initialize(
            wormhole_contract.address(),
            single_update_fee,
            valid_time_period,
            data_source_chain_ids,
            data_source_emitter_addresses,
            governance_chain_id,
            governance_emitter_address,
            governance_initial_sequence,
        );
    }

    #[motsu::test]
    fn tests_pyth_end_to_end_with_update(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data = good_update1();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
            .update_price_feeds(update_data);
        assert!(result.is_ok());

        let price_result = pyth_contract.sender(alice).get_price_unsafe(TEST_PRICE_ID);
        assert!(price_result.is_ok());
        assert_eq!(price_result.unwrap(), good_update1_results());
    }

    #[motsu::test]
    fn test_update_price_feed_reverts_insufficient_fee(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        alice.fund(U256::from(200));

        let update_data = good_update1();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();
        let small_update_fee = update_fee / U256::from(2);

        let result = pyth_contract
            .sender_and_value(alice, small_update_fee)
            .update_price_feeds(update_data);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), PythReceiverError::InsufficientFee);
    }

    #[motsu::test]
    fn test_get_price_after_multiple_different_updates_returns_recent_price(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data1 = good_update1();
        let update_fee1 = mock_get_update_fee(update_data1.clone()).unwrap();

        let update_data2 = good_update2();
        let update_fee2 = mock_get_update_fee(update_data2.clone()).unwrap();

        alice.fund(update_fee1 + update_fee2);

        let result1 = pyth_contract
            .sender_and_value(alice, update_fee1)
            .update_price_feeds(update_data1);
        assert!(result1.is_ok());

        let result2 = pyth_contract
            .sender_and_value(alice, update_fee2)
            .update_price_feeds(update_data2);
        assert!(result2.is_ok());

        let price_result = pyth_contract.sender(alice).get_price_unsafe(TEST_PRICE_ID);
        assert!(price_result.is_ok());
        assert_eq!(price_result.unwrap(), good_update2_results());
    }

    #[motsu::test]
    fn test_get_price_with_no_update_reverts_with_price_unavailable(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let price_result = pyth_contract.sender(alice).get_price_unsafe(TEST_PRICE_ID);
        assert!(price_result.is_err());
        assert_eq!(
            price_result.unwrap_err(),
            PythReceiverError::PriceUnavailable
        );
    }

    #[motsu::test]
    fn test_get_price_no_older_than_with_random_id_reverts_with_price_unavailable(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        MockClock::set_time(Duration::from_secs(1761573860)); // less than good_update2().timestamp + 1s
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

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
    fn test_get_price_no_older_than_where_update_younger_than_max_age_returns_price(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        MockClock::set_time(Duration::from_secs(1761573860));
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data = good_update2();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
            .update_price_feeds(update_data);
        assert!(result.is_ok());

        let price_result = pyth_contract
            .sender(alice)
            .get_price_no_older_than(TEST_PRICE_ID, u64::MAX);
        assert!(price_result.is_ok());
        assert_eq!(price_result.unwrap(), good_update2_results());
    }

    #[motsu::test]
    fn test_get_price_no_older_than_reverts_too_old(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        MockClock::set_time(Duration::from_secs(1761573860));
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data = good_update2();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
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
    fn test_multiple_updates_in_same_vaa_different_ids_updates_both(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data = multiple_updates_same_vaa();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
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
        assert_eq!(first_price_result.unwrap(), multiple_updates_results()[0]);

        let second_price_result = pyth_contract.sender(alice).get_price_unsafe(second_id);
        assert!(second_price_result.is_ok());
        assert_eq!(second_price_result.unwrap(), multiple_updates_results()[1]);
    }

    #[motsu::test]
    fn test_multiple_updates_different_ids_updates_both(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data = multiple_updates_diff_vaa();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
            .update_price_feeds(update_data);
        assert!(result.is_ok());

        let first_id: [u8; 32] = [
            0x3f, 0xa4, 0x25, 0x28, 0x48, 0xf9, 0xf0, 0xa1, 0x48, 0x0b, 0xe6, 0x27, 0x45, 0xa4,
            0x62, 0x9d, 0x9e, 0xb1, 0x32, 0x2a, 0xeb, 0xab, 0x8a, 0x79, 0x1e, 0x34, 0x4b, 0x3b,
            0x9c, 0x1a, 0xdc, 0xf5,
        ];
        let second_id: [u8; 32] = TEST_PRICE_ID;

        let first_price_result = pyth_contract.sender(alice).get_price_unsafe(first_id);
        assert!(first_price_result.is_ok());
        assert_eq!(
            first_price_result.unwrap(),
            multiple_updates_diff_vaa_results()[0]
        );

        let second_price_result = pyth_contract.sender(alice).get_price_unsafe(second_id);
        assert!(second_price_result.is_ok());
        assert_eq!(
            second_price_result.unwrap(),
            multiple_updates_diff_vaa_results()[1]
        );
    }
}
