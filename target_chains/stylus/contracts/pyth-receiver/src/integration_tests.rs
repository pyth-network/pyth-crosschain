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
    use stylus_sdk::types::AddressVM;
    use wormhole_contract::WormholeContract;

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

    #[cfg(test)]
    fn get_total_fee(total_num_updates: u64) -> U256 {
        U256::from(total_num_updates).saturating_mul(SINGLE_UPDATE_FEE_IN_WEI)
            + TRANSACTION_FEE_IN_WEI
    }

    #[cfg(test)]
    fn pyth_init(
        pyth_contract: &Contract<PythReceiver>,
        wormhole_contract: &Contract<WormholeContract>,
        alice: &Address,
    ) -> Result<(), PythReceiverError> {
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
        )?;

        Ok(())
    }

    #[cfg(test)]
    fn pyth_wormhole_init(
        pyth_contract: &Contract<PythReceiver>,
        wormhole_contract: &Contract<WormholeContract>,
        alice: &Address,
    ) -> Result<(), PythReceiverError> {
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

        pyth_init(pyth_contract, wormhole_contract, alice)?;
        Ok(())
    }

    #[motsu::test]
    fn tests_pyth_end_to_end_with_update(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data = ban_usd_update();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
            .update_price_feeds(update_data);

        assert!(result.is_ok());

        assert_eq!(alice.balance(), U256::ZERO);
        assert_eq!(pyth_contract.balance(), update_fee);

        let price_result = pyth_contract
            .sender(alice)
            .get_price_unsafe(ban_usd_feed_id());
        assert!(price_result.is_ok());
        assert_eq!(price_result.unwrap(), ban_usd_results_get_price());
    }

    #[motsu::test]
    fn test_update_price_feed_reverts_insufficient_fee(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        alice.fund(U256::from(200));

        let update_data = ban_usd_update();
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
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data1 = ban_usd_update();
        let update_fee1 = mock_get_update_fee(update_data1.clone()).unwrap();

        let update_data2 = btc_usd_update();
        let update_fee2 = mock_get_update_fee(update_data2.clone()).unwrap();

        alice.fund(update_fee1 + update_fee2);

        let result1 = pyth_contract
            .sender_and_value(alice, update_fee1)
            .update_price_feeds(update_data1);
        assert!(result1.is_ok());

        assert_eq!(alice.balance(), update_fee2);
        assert_eq!(pyth_contract.balance(), update_fee1);

        let result2 = pyth_contract
            .sender_and_value(alice, update_fee2)
            .update_price_feeds(update_data2);
        assert!(result2.is_ok());

        assert_eq!(alice.balance(), U256::ZERO);
        assert_eq!(pyth_contract.balance(), update_fee1 + update_fee2);

        let price_result = pyth_contract
            .sender(alice)
            .get_price_unsafe(ban_usd_feed_id());
        assert!(price_result.is_ok());
        assert_eq!(price_result.unwrap(), ban_usd_results_get_price());
    }

    #[motsu::test]
    fn test_get_price_with_no_update_reverts_with_price_unavailable(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let price_result = pyth_contract
            .sender(alice)
            .get_price_unsafe(ban_usd_feed_id());
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
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

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
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data = btc_usd_update();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
            .update_price_feeds(update_data);
        assert!(result.is_ok());

        assert_eq!(alice.balance(), U256::ZERO);
        assert_eq!(pyth_contract.balance(), update_fee);

        let price_result = pyth_contract
            .sender(alice)
            .get_price_no_older_than(btc_usd_feed_id(), u64::MAX);
        assert!(price_result.is_ok());
        assert_eq!(price_result.unwrap(), btc_usd_results_get_price());
    }

    #[motsu::test]
    fn test_get_price_no_older_than_reverts_too_old(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        MockClock::set_time(Duration::from_secs(1761573860));
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data = btc_usd_update();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
            .update_price_feeds(update_data);
        assert!(result.is_ok());

        assert_eq!(alice.balance(), U256::ZERO);
        assert_eq!(pyth_contract.balance(), update_fee);

        let price_result = pyth_contract
            .sender(alice)
            .get_price_no_older_than(btc_usd_feed_id(), 1);
        println!("Price result: {:?}", price_result);
        assert!(price_result.is_err());
        assert_eq!(
            price_result.unwrap_err(),
            PythReceiverError::NewPriceUnavailable
        );
    }

    #[motsu::test]
    fn test_multiple_updates_different_ids_updates_both(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data = multiple_updates_diff_vaa();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
            .update_price_feeds(update_data);
        assert!(result.is_ok());

        assert_eq!(alice.balance(), U256::ZERO);
        assert_eq!(pyth_contract.balance(), update_fee);

        let first_price_result = pyth_contract
            .sender(alice)
            .get_price_unsafe(ban_usd_feed_id());
        assert!(first_price_result.is_ok());
        assert_eq!(
            first_price_result.unwrap(),
            multiple_updates_diff_vaa_results_get_price()[0]
        );

        let second_price_result = pyth_contract
            .sender(alice)
            .get_price_unsafe(btc_usd_feed_id());
        assert!(second_price_result.is_ok());
        assert_eq!(
            second_price_result.unwrap(),
            multiple_updates_diff_vaa_results_get_price()[1]
        );
    }

    #[motsu::test]
    fn test_price_feed_exists(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        assert!(!pyth_contract
            .sender(alice)
            .price_feed_exists(ban_usd_feed_id()));

        let update_data = ban_usd_update();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
            .update_price_feeds(update_data);
        assert!(result.is_ok());

        assert_eq!(alice.balance(), U256::ZERO);
        assert_eq!(pyth_contract.balance(), update_fee);

        assert!(pyth_contract
            .sender(alice)
            .price_feed_exists(ban_usd_feed_id()));
    }

    #[motsu::test]
    fn test_query_price_feed_doesnt_exist(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let price_result = pyth_contract
            .sender(alice)
            .query_price_feed(ban_usd_feed_id());

        assert!(price_result.is_err());
        assert_eq!(
            price_result.unwrap_err(),
            PythReceiverError::PriceFeedNotFound
        );
    }

    #[motsu::test]
    fn test_query_price_feed_after_one_feed_update(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data = ban_usd_update();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
            .update_price_feeds(update_data);

        assert_eq!(alice.balance(), U256::ZERO);
        assert_eq!(pyth_contract.balance(), update_fee);

        assert!(result.is_ok());

        let price_result = pyth_contract
            .sender(alice)
            .query_price_feed(ban_usd_feed_id());

        assert!(price_result.is_ok());
        assert_eq!(price_result.unwrap(), ban_usd_results_full());
    }

    #[motsu::test]
    fn test_query_price_feed_after_multiple_updates(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let update_data = multiple_updates_diff_vaa();
        let update_fee = mock_get_update_fee(update_data.clone()).unwrap();

        alice.fund(update_fee);

        let result = pyth_contract
            .sender_and_value(alice, update_fee)
            .update_price_feeds(update_data);

        assert_eq!(alice.balance(), U256::ZERO);
        assert_eq!(pyth_contract.balance(), update_fee);

        assert!(result.is_ok());

        let price_result1 = pyth_contract
            .sender(alice)
            .query_price_feed(ban_usd_feed_id());

        assert!(price_result1.is_ok());
        assert_eq!(
            price_result1.unwrap(),
            multiple_updates_diff_vaa_results_full()[0]
        );

        let price_result2 = pyth_contract
            .sender(alice)
            .query_price_feed(btc_usd_feed_id());

        assert!(price_result2.is_ok());
        assert_eq!(
            price_result2.unwrap(),
            multiple_updates_diff_vaa_results_full()[1]
        );
    }

    #[motsu::test]
    fn test_double_initialization_reverts(
        pyth_contract: Contract<PythReceiver>,
        wormhole_contract: Contract<WormholeContract>,
        alice: Address,
    ) {
        let _ = pyth_wormhole_init(&pyth_contract, &wormhole_contract, &alice);

        let double_init = pyth_init(&pyth_contract, &wormhole_contract, &alice);

        assert!(double_init.is_err());
        assert_eq!(
            double_init.unwrap_err(),
            PythReceiverError::AlreadyInitialized
        );
    }
}
